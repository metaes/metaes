import { Environment, EnvironmentBase, Reference } from "./environment";
import { log } from "./logging";
import { Context, evalFunctionBody, metaesEval, isScript, toScript } from "./metaes";
import { Continuation, ErrorContinuation, EvaluationConfig, Source, Script } from "./types";

const referencesMaps = new Map<Context, Map<object | Function, string>>();

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

export type MetaesMessage = { script: Script; env?: EnvironmentBase };

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

export function assertMessage(message: MetaesMessage): MetaesMessage {
  if (!isScript(message.script)) {
    throw new Error("Message should contain a script instance");
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
      environmentFromMessage(context, {
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
            metaesEval(message.script, env.values.c, env.values.cerr, env);
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
            console.log("s", source);
            try {
              send({
                script: toScript(source),
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
