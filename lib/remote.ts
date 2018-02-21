import { ScriptingContext, metaesEval, evaluateFunctionBodyPromisified } from "./metaes";
import { EnvironmentBase, Environment, withValues } from "./environment";
import { EvaluationSuccess, EvaluationError, Source, EvaluationConfig } from "./types";

const referencesMaps = new Map<ScriptingContext, Map<object | Function, string>>();

function pairs(o: object) {
  let result: any[] = [];
  for (let k of Object.keys(o)) {
    result.push([k, o[k]]);
  }
  return result;
}

const getReferenceMap = (context: ScriptingContext) => {
  let env = referencesMaps.get(context);
  if (!env) {
    referencesMaps.set(context, (env = new Map()));
    return env;
  }
  return env;
};

export type Message = { source: Source; env?: EnvironmentBase };

function createRemoteFunction(context: ScriptingContext, id: string) {
  let boundary = getReferenceMap(context);
  let fn = (...args) =>
    evaluateFunctionBodyPromisified(
      context,
      args => {
        fn.apply(null, args);
      },
      environmentFromJSON(context, {
        values: { args },
        references: { fn: { id } }
      })
    );
  boundary.set(fn, id);
  return fn;
}

export function environmentFromJSON(context: ScriptingContext, environment: EnvironmentBase): Environment {
  let boundaryEnv = getReferenceMap(context);
  let values = environment.values || {};
  if (environment.references) {
    outer: for (let [key, { id }] of pairs(environment.references)) {
      for (let [value, boundaryId] of boundaryEnv.entries()) {
        // Special case for "undefined" id. It's a hack to transfer `undefined` value, not possible in JSON.
        if (id === "undefined") {
          values[key] = void 0;
        } else if (boundaryId === id) {
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

export function environmentToJSON(context: ScriptingContext, environment: EnvironmentBase): EnvironmentBase {
  let boundaryEnv = getReferenceMap(context);
  let references: { [key: string]: { id: string } } = {};
  let values = {};

  for (let [k, v] of pairs(environment.values)) {
    if (k) {
      if (typeof v === "function" || typeof v === "object") {
        if (!boundaryEnv.has(v)) {
          boundaryEnv.set(v, Math.random() + "");
        }
        references[k] = { id: boundaryEnv.get(v)! };

        // add here whatever there is as a value, it'll be serialized to json
        if (typeof v === "object") {
          values[k] = v;
        }
      } else if (typeof v === "undefined") {
        references[k] = { id: "undefined" };
      } else {
        values[k] = v;
      }
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

export const createConnector = (WebSocketConstructor: typeof WebSocket) => (connectionString: string) =>
  new Promise<ScriptingContext>(resolve => {
    const connect = () => {
      const client = new WebSocketConstructor(connectionString);
      let context: ScriptingContext;

      const send = (message: Message) => client.send(JSON.stringify(assertMessage(message)));

      client.addEventListener("close", () => {
        setTimeout(connect, 5000);
      });
      client.addEventListener("message", e => {
        const message = assertMessage(JSON.parse(e.data) as Message);
        if (message.env) {
          const env = environmentFromJSON(context, message.env);
          metaesEval(message.source, env.values["c"], env.values["cerr"], env, { onError: console.log });
        } else {
          console.debug("ignored message without env:", message);
        }
      });
      client.addEventListener("open", async () => {
        context = {
          evaluate: (
            source: Source,
            c?: EvaluationSuccess,
            cerr?: EvaluationError,
            environment?: Environment,
            _config?: EvaluationConfig
          ) =>
            send({
              source,
              env: environmentToJSON(context, withValues({ c, cerr }, environment))
            })
        };
        resolve(context);
      });
    };
    connect();
  });
