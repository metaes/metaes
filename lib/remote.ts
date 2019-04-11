import { getEnvironmentForValue, GetValue } from "./environment";
import { Apply, GetProperty, Identifier, SetProperty } from "./interpreter/base";
import { ECMAScriptInterpreters } from "./interpreters";
import { log } from "./logging";
import { Context, evalAsPromise, evalFnBody, evalFnBodyAsPromise, isScript, MetaesContext, metaesEval } from "./metaes";
import * as NodeTypes from "./nodeTypes";
import {
  Continuation,
  Environment,
  EnvironmentBase,
  ErrorContinuation,
  EvaluationConfig,
  FullyQualifiedMetaesMessage,
  MetaesMessage,
  Reference,
  Source
} from "./types";

export function patchNodeFetch() {
  if (typeof fetch === "undefined" && typeof global === "object") {
    /**
     * Redundancy created to skip SystemJS eager dependencies finder.
     * In dev mode using CommonJS modules in browser it disallows conditional modules loading.
     * For production it will be optimized out.
     */
    const _require = require;
    global.fetch = _require("node-fetch");
  }
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// TODO: instead use env.prev and while stringification take into account if prev is present (recursively)
export function mergeValues(values: object, environment?: Environment): EnvironmentBase {
  if (environment) {
    for (let k of Object.keys(values)) {
      environment.values[k] = values[k];
    }
    return environment;
  } else {
    return { values };
  }
}

export function environmentFromMessage(
  environment: EnvironmentBase,
  referencesMap: Map<object | Function, string>,
  context: Context
): Environment {
  const values = environment.values || {};
  if (environment.refs) {
    outer: for (let [key, { id }] of Object.entries(environment.refs)) {
      for (let [value, boundaryId] of referencesMap.entries()) {
        if (boundaryId === id) {
          values[key] = value;
          continue outer;
        }
      }
      // TODO: don't know yet if it's function or object. Solve this ambiguity
      // Set value only if nothing in values dict was provided.
      if (!values[key]) {
        values[key] = createRemoteFunction(id, referencesMap, context);
      }
    }
  }
  return { values };
}

export function environmentToMessage(
  environment: EnvironmentBase,
  referencesMap: Map<object | Function, string>
): EnvironmentBase {
  const references: { [key: string]: Reference } = {};
  const values = {};

  for (let [key, value] of Object.entries(environment.values)) {
    values[key] = value;
    if (typeof value === "function" || typeof value === "object") {
      if (!referencesMap.has(value)) {
        referencesMap.set(value, uuidv4());
      }
      references[key] = { id: referencesMap.get(value)! };
    }
  }
  return Object.keys(references).length ? { refs: references, values } : { values };
}

export function toFullyQualifiedMessage(message: MetaesMessage): FullyQualifiedMetaesMessage {
  const fqMessage: any = {};
  if (typeof message !== "object" || Array.isArray(message)) {
    return { input: message, env: { values: {} } };
  } else {
    if ("input" in message) {
      if (typeof message.input === "string") {
        try {
          fqMessage.input = JSON.parse(message.input);
        } catch {
          // Couldn't parse JSON, treat it as JavaScript code
          fqMessage.input = message.input;
        }
      } else {
        fqMessage.input = message.input;
      }
      // env
      if ("env" in message && typeof message.env === "object") {
        if ("values" in message.env) {
          fqMessage.env = message.env;
        } else {
          fqMessage.env = { values: message.env };
        }
      } else {
        fqMessage.env = { values: {} };
      }
      if ("refs" in message && typeof message.refs === "object") {
        fqMessage.env.refs = message.refs;
      }
      return fqMessage;
    } else {
      return {
        input: message,
        env: { values: {} }
      };
    }
  }
}

function createRemoteFunction(id: string, referencesMap, context: Context) {
  const fn = (...args) =>
    evalFnBody(
      {
        context,
        source: args => {
          fn.apply(null, args);
        }
      },
      console.log,
      console.error,
      environmentFromMessage(
        {
          values: { args },
          refs: { fn: { id } }
        },
        referencesMap,
        context
      )
    );
  referencesMap.set(fn, id);
  return fn;
}

export const createHTTPConnector = (url: string): Context => {
  patchNodeFetch();

  function send(message: MetaesMessage) {
    log("[Client: sending message]", message);
    const stringified = JSON.stringify(message);
    log("[Client: sending message, after validation]", stringified);
    const config = { method: "POST", body: stringified, headers: { "content-type": "application/json" } };
    return fetch(url, config).then(async response => ({ text: await response.text(), status: response.status }));
  }

  const context = {
    async evaluate(
      input: Source,
      c?: Continuation,
      cerr?: ErrorContinuation,
      env?: Environment,
      _config?: EvaluationConfig
    ) {
      if (typeof input === "function") {
        input = input.toString();
      }
      if (isScript(input) && typeof input.source === "function") {
        input.source = input.source.toString();
      }
      try {
        const { status, text } = await send({
          input,
          env
        });
        log("[Client: Got response, raw]", text);
        const value = JSON.parse(text);
        log("[Client: Got response, parsed]", value);
        if (status === 400) {
          cerr && cerr(value);
        } else {
          c && c(value);
        }
      } catch (e) {
        log("[Client: Sending message error]", e);
        if (cerr) {
          cerr(e);
        }
      }
    }
  };
  return context;
};

type ClosableContext = Context & { close: () => void };

export const createWSConnector = (WebSocketConstructor: typeof WebSocket, autoReconnect = false) => (
  connectionString: string
) =>
  new Promise<ClosableContext>((resolve, reject) => {
    const referencesMap = new Map();

    const connect = () => {
      const socket = new WebSocketConstructor(connectionString);
      let context: ClosableContext;

      const send = (message: MetaesMessage) => {
        const stringified = JSON.stringify(message);
        log("[Client: sending message]", stringified);
        socket.send(stringified);
      };
      if (autoReconnect) {
        socket.addEventListener("close", () => {
          setTimeout(connect, 5000);
        });
      }

      socket.addEventListener("message", e => {
        try {
          const message = toFullyQualifiedMessage(JSON.parse(e.data));

          if (message.env) {
            const env = environmentFromMessage(message.env, referencesMap, context);
            log("[Client: raw message]", e.data);
            log("[Client: message]", message);
            log("[Client: env is]", env);
            metaesEval(message.input, env.values.c, env.values.cerr, env);
          } else {
            log("[Client: ignored message without env:]", message);
          }
        } catch (e) {
          log("[Client: receiving message error]", e);
        }
      });
      socket.addEventListener("error", reject);
      socket.addEventListener("open", async () => {
        context = {
          close: () => socket.close(),
          evaluate: (
            input: Source,
            c?: Continuation,
            cerr?: ErrorContinuation,
            environment?: Environment,
            _config?: EvaluationConfig
          ) => {
            if (typeof input === "function") {
              input = input.toString();
            }
            if (isScript(input) && typeof input.source === "function") {
              input.source = input.source.toString();
            }
            try {
              send({
                input,
                env: environmentToMessage(mergeValues({ c, cerr }, environment), referencesMap)
              });
            } catch (e) {
              if (cerr) {
                cerr(e);
              }
              log("[Client: Sending message error]", e);
            }
          }
        };
        resolve(context);
      });
    };
    connect();
  });

export function getParsingContext(context: Context) {
  return {
    evaluate(input, c, cerr, env, config) {
      context.evaluate(input, c, cerr, env, config);
    }
  };
}

export function getSerializingContext(environment: Environment) {
  const _valueToId = new Map<object, string>();
  const _idsToValues = new Map<string, object>();
  const innerContext = new MetaesContext(undefined, console.error, environment);

  const context = {
    async evaluate(script, c, cerr, env) {
      let _encounteredReferences = new Set(),
        _parentOf = new Map<object, object>(),
        _finalReferences = new Set();

      const interpreters = {
        values: {
          Apply(e) {
            const { thisValue, fn } = e;
            if (
              thisValue &&
              Array.isArray(thisValue) &&
              (belongsToRootEnv(thisValue) || belongsToRootHeap(thisValue)) &&
              (fn === [].map || fn === [].filter)
            ) {
              thisValue
                .filter(element => typeof element === "object" || typeof element === "function")
                .forEach(element => {
                  _encounteredReferences.add(element);
                  _parentOf.set(element, thisValue);
                });
            }
            Apply.apply(null, arguments);
          },
          GetValue({ name }, _c, _cerr, env) {
            const _found = getEnvironmentForValue(env, name);
            let obj;
            if (
              _found &&
              (obj = _found.values) &&
              (belongsToRootEnv(obj) ||
                ((belongsToRootHeap(obj) && typeof obj[name] === "object") || typeof obj[name] === "function"))
            ) {
              _parentOf.set(obj[name], obj);
            }
            GetValue.apply(null, arguments);
          },
          GetProperty(e: NodeTypes.GetProperty, c, cerr, env, config) {
            const { object } = e;
            _encounteredReferences.add(object);
            GetProperty(
              e,
              value => {
                if (typeof value === "object" || typeof value === "function") {
                  _encounteredReferences.add(value);
                  _parentOf.set(value, object);
                }
                c(value);
              },
              cerr,
              env,
              config
            );
          },
          Identifier(e, c, cerr, env, config) {
            Identifier(
              e,
              value => {
                if (typeof value === "object" || typeof value === "function") {
                  _encounteredReferences.add(value);
                  if (belongsToRootEnv(value)) {
                    _parentOf.set(value, environment.values);
                  }
                }
                c(value);
              },
              cerr,
              env,
              config
            );
          }
        },
        prev: ECMAScriptInterpreters
      };

      function belongsToRootEnv(value: any) {
        for (let k in environment.values) {
          if (environment.values[k] === value) {
            return true;
          }
        }
        return false;
      }
      function belongsToRootHeap(value) {
        while ((value = _parentOf.get(value))) {
          if (value === environment.values) {
            return true;
          }
        }
        return false;
      }
      try {
        const result =
          typeof script === "function"
            ? await evalFnBodyAsPromise(
                { context: innerContext, source: script },
                env || { values: {}, prev: environment },
                { interpreters }
              )
            : await evalAsPromise(innerContext, script, env || { values: {}, prev: environment }, { interpreters });

        function mapRefs(obj) {
          function replacer(value) {
            if (_encounteredReferences.has(value) && belongsToRootHeap(value)) {
              _finalReferences.add(value);

              let id = _valueToId.get(value);
              if (!id) {
                id = uuidv4();
                _valueToId.set(value, id);
                _idsToValues.set(id, value);
              }
              return "@" + id;
            } else {
              return value;
            }
          }
          return (function recursiveMap(obj) {
            if (Array.isArray(obj)) {
              return obj.map(item => recursiveMap(replacer(item)));
            } else if (typeof obj === "object") {
              const result = {};
              for (let k in obj) {
                result[k] = recursiveMap(replacer(obj[k]));
              }
              return result;
            } else {
              return obj;
            }
          })(obj);
        }

        // TODO: should produce various levels or message accuracy
        c({
          input: mapRefs(result),
          refs: [..._finalReferences]
            .map(value => [_valueToId.get(value), value])
            .reduce((prev, [k, v]) => {
              prev[k] = { type: typeof v };
              return prev;
            }, {})
        });
      } catch (e) {
        cerr(e.value || e);
      }
    }
  };

  return context;
}

// JSON.stringify(result, replacer);

// const unquote = (json: any) =>
//   JSON.parse(JSON.stringify(json), function(_, value) {
//     if (_idsToValues.has(value)) {
//       return "buka";
//     }
//     return value;
//   });

export function getBindingInterpretersFor(otherContext: Context, allowedReferences?: string[]) {
  const remoteObjects = new WeakSet();

  return {
    values: {
      Apply({ e, fn, thisValue, args }, c, cerr, _env, config) {
        if (remoteObjects.has(thisValue)) {
          const values = Object.assign(
            { fn },
            args.reduce((result, next, i) => {
              result["arg" + i] = next;
              return result;
            }, {})
          );
          const callee = thisValue
            ? {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: thisValue
                },
                property: e.callee.property
              }
            : {
                type: "Identifier",
                name: "fn"
              };
          otherContext.evaluate(
            {
              type: "CallExpression",
              callee,
              arguments: args.map((_, i) => ({ type: "Identifier", name: "arg" + i }))
            },
            c,
            cerr,
            {
              values
            },
            config
          );
        } else {
          Apply.apply(null, arguments);
        }
      },
      GetProperty({ object, property }, c, cerr) {
        if (remoteObjects.has(object)) {
          otherContext.evaluate(
            {
              type: "MemberExpression",
              object: { type: "Identifier", name },
              property: { type: "Identifier", name: property }
            },
            c,
            cerr,
            {
              values: { [name]: object }
            }
          );
        } else {
          GetProperty.apply(null, arguments);
        }
      },
      SetProperty({ object, property, value, operator }, c, cerr) {
        // object instanceof RemoteObject
        //   ? otherContext.evaluate(`${remoteObjectsToNames.get(object)}.${property}${operator}${value}`, c, cerr)
        //   : SetProperty.apply(null, arguments);

        SetProperty.apply(null, arguments);
      },
      Identifier(e, c, cerr, env, config) {
        Identifier(
          e,
          c,
          exception => {
            const { type } = exception;
            if (
              type === "ReferenceError" &&
              (!allowedReferences || (allowedReferences && allowedReferences.includes(e.name)))
            ) {
              otherContext.evaluate(
                e.name,
                value => {
                  if (typeof value === "object") {
                    remoteObjects.add(value);
                  }
                  c(value);
                },
                cerr
              );
            } else {
              cerr(exception);
            }
          },
          env,
          config
        );
      }
    },
    prev: ECMAScriptInterpreters
  };
}
