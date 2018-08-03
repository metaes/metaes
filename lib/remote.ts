import { Context, metaesEval, evalFunctionBody } from "./metaes";
import { EnvironmentBase, Environment, mergeValues, Reference } from "./environment";
import { Continuation, ErrorContinuation, Source, EvaluationConfig } from "./types";
import { log } from "./logging";

const referencesMaps = new Map<Context, Map<object | Function, string>>();

export const getReferencesMap = (context: Context) => {
  let env = referencesMaps.get(context);
  if (!env) {
    referencesMaps.set(context, (env = new Map()));
    return env;
  }
  return env;
};

export type Message = { source: Source; env?: EnvironmentBase };

export function environmentFromJSON(context: Context, environment: EnvironmentBase): Environment {
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

const MaxSize = 10;

export function environmentToJSON(context: Context, environment: EnvironmentBase): EnvironmentBase {
  const referencesMap = getReferencesMap(context);
  const references: { [key: string]: Reference } = {};
  const values = {};

  for (let [k, v] of Object.entries(environment.values)) {
    if (typeof v === "function" || typeof v === "object") {
      if (!referencesMap.has(v)) {
        referencesMap.set(v, Math.random() + "");
      }
      references[k] = { id: referencesMap.get(v)! };

      if (Array.isArray(v) && v.length > MaxSize) {
        values[k] = v.slice(0, MaxSize);
      } else if (typeof v === "object") {
        values[k] = v;
      }
    } else {
      values[k] = v;
    }
  }
  return Object.keys(references).length ? { references, values } : { values };
}

export function assertMessage(message: Message): Message {
  if (typeof message.source !== "string" && typeof message.source !== "object") {
    throw new Error("Message should contain `source` value of type string or object.");
  }
  if (message.env && typeof message.env !== "object") {
    throw new Error("Message should contain `env` value of type object.");
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
      environmentFromJSON(context, {
        values: { args },
        references: { fn: { id } }
      })
    );
  referencesMap.set(fn, id);
  return fn;
}

export const createConnector = (WebSocketConstructor: typeof WebSocket) => (connectionString: string) =>
  new Promise<Context>((resolve, reject) => {
    const connect = () => {
      const client = new WebSocketConstructor(connectionString);
      let context: Context;

      const send = (message: Message) => {
        const stringified = JSON.stringify(assertMessage(message));
        log("[Client: sending message]", stringified);
        client.send(stringified);
      };

      client.addEventListener("close", () => {
        setTimeout(connect, 5000);
      });
      client.addEventListener("message", e => {
        try {
          const message = assertMessage(JSON.parse(e.data) as Message);
          if (message.env) {
            const env = environmentFromJSON(context, message.env);
            log("[Client: raw message]", e.data);
            log("[Client: message]", message);
            log("[Client: env is]", env);
            metaesEval(message.source, env.values.c, env.values.cerr, env);
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
            source: Source,
            c?: Continuation,
            cerr?: ErrorContinuation,
            environment?: Environment,
            _config?: EvaluationConfig
          ) => {
            try {
              send({
                source,
                env: environmentToJSON(context, mergeValues({ c, cerr }, environment))
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
