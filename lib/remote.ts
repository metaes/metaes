import { Environment, EnvironmentBase, Reference } from "./environment";
import { log } from "./logging";
import { Context, evalFunctionBody, isScript, metaesEval } from "./metaes";
import { ASTNode } from "./nodes/nodes";
import { Continuation, ErrorContinuation, EvaluationConfig, Script, Source } from "./types";

const referencesMaps = new Map<Context, Map<object | Function, string>>();

export function patchNodeFetch() {
  if (typeof fetch === "undefined" && typeof global === "object") {
    global.fetch = require("node-fetch");
  }
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

export const getReferencesMap = (context: Context) => {
  let env = referencesMaps.get(context);
  if (!env) {
    referencesMaps.set(context, (env = new Map()));
    return env;
  }
  return env;
};

export type MetaesMessage = { input: Script | string | ASTNode; env?: EnvironmentBase };

export function environmentFromMessage(context: Context, environment: EnvironmentBase): Environment {
  const referencesMap = getReferencesMap(context);
  const values = environment.values || {};
  if (environment.references) {
    outer: for (let [key, { id }] of Object.entries(environment.references)) {
      for (let [value, boundaryId] of referencesMap.entries()) {
        if (boundaryId === id) {
          values[key] = value;
          continue outer;
        }
      }
      // TODO: don't know yet if it's function or object. Solve this ambiguity
      // Set value only if nothing in values dict was provided.
      if (!values[key]) {
        values[key] = createRemoteFunction(context, id);
      }
    }
  }
  return { values };
}

export function environmentToMessage(context: Context, environment: EnvironmentBase): EnvironmentBase {
  const referencesMap = getReferencesMap(context);
  const references: { [key: string]: Reference } = {};
  const values = {};

  for (let [key, value] of Object.entries(environment.values)) {
    values[key] = value;
    if (typeof value === "function" || typeof value === "object") {
      if (!referencesMap.has(value)) {
        referencesMap.set(value, Math.random() + "");
      }
      references[key] = { id: referencesMap.get(value)! };
    }
  }
  return Object.keys(references).length ? { references, values } : { values };
}

export function assertMessage(message: MetaesMessage, requiresEnvironment = true): MetaesMessage {
  const errors: Error[] = [];

  if (!message.input) {
    errors.push(new Error("Message should define an `input` field."));
  }
  if (typeof message.input === "function") {
    errors.push(new Error("Message `input` field can't be a function"));
  }
  if (!(isScript(message.input) || typeof message.input === "object" || typeof message.input === "string")) {
    errors.push(new Error("Message input is not valid"));
  }
  if (requiresEnvironment) {
    if (!message.env) {
      errors.push(new Error("Message should contain at least empty environment"));
    }
    if (message.env && typeof message.env !== "object") {
      errors.push(new Error("Message should contain `env` value of type object."));
    }
  }
  if (errors.length) {
    throw errors;
  }
  return message;
}

function createRemoteFunction(context: Context, id: string) {
  const referencesMap = getReferencesMap(context);
  const fn = (...args) =>
    evalFunctionBody(
      context,
      args => {
        fn.apply(null, args);
      },
      environmentFromMessage(context, {
        values: { args },
        references: { fn: { id } }
      })
    );
  referencesMap.set(fn, id);
  return fn;
}

export const createHTTPConnector = (url: string): Context => {
  patchNodeFetch();

  function send(message: MetaesMessage) {
    log("[Client: sending message]", message);
    const stringified = JSON.stringify(assertMessage(message, false));
    log("[Client: sending message, after validation]", stringified);
    const config = { method: "POST", body: stringified, headers: { "content-type": "application/json" } };
    return fetch(url, config).then(async response => ({ text: await response.text(), status: response.status }));
  }

  const context = {
    async evaluate(
      input: Source,
      c?: Continuation,
      cerr?: ErrorContinuation,
      environment?: Environment,
      _config?: EvaluationConfig
    ) {
      if (typeof input === "function") {
        input = input.toString();
      }
      try {
        const { status, text } = await send({
          input,
          env: environmentToMessage(context, mergeValues({ c, cerr }, environment))
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
        if (cerr) {
          cerr(e);
        }
        log("[Client: Sending message error]", e);
      }
    }
  };
  return context;
};

export const createWSConnector = (WebSocketConstructor: typeof WebSocket) => (connectionString: string) =>
  new Promise<Context>((resolve, reject) => {
    const connect = () => {
      const client = new WebSocketConstructor(connectionString);
      let context: Context;

      const send = (message: MetaesMessage) => {
        const stringified = JSON.stringify(assertMessage(message));
        log("[Client: sending message]", stringified);
        client.send(stringified);
      };

      client.addEventListener("close", () => {
        setTimeout(connect, 5000);
      });
      client.addEventListener("message", e => {
        try {
          const message = assertMessage(JSON.parse(e.data) as MetaesMessage);

          if (message.env) {
            const env = environmentFromMessage(context, message.env);
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
      client.addEventListener("error", reject);
      client.addEventListener("open", async () => {
        context = {
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
            try {
              send({
                input,
                env: environmentToMessage(context, mergeValues({ c, cerr }, environment))
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
