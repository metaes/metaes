import { ScriptingContext, Source, metaESEval, evaluateFunctionBodyPromisified } from "./metaes";
import { EnvironmentBase, Environment, valuesIntoEnvironment } from "./environment";
import { SuccessCallback, ErrorCallback } from "./types";

const boundaryEnvironments = new Map<ScriptingContext, Map<object | Function, string>>();

function pairs(o: object) {
  let result: any[] = [];
  for (let k of Object.keys(o)) {
    result.push([k, o[k]]);
  }
  return result;
}

const getBoundaryEnv = (context: ScriptingContext) => {
  let env = boundaryEnvironments.get(context);
  if (!env) {
    boundaryEnvironments.set(context, (env = new Map()));
    return env;
  }
  return env;
};

export type Message = { source: Source; env?: EnvironmentBase };

function createRemoteFunction(
  context: ScriptingContext,
  id: string,
  __remoteContextToCallWhenFunctionExecutes?: ScriptingContext
) {
  let boundary = getBoundaryEnv(context);
  let fn = (...args) =>
    evaluateFunctionBodyPromisified(
      __remoteContextToCallWhenFunctionExecutes || context,
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

export function environmentFromJSON(
  context: ScriptingContext,
  environment: EnvironmentBase,
  __remoteContextToCallWhenFunctionExecutes?: ScriptingContext
): Environment {
  let boundaryEnv = getBoundaryEnv(context);
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
        values[key] = createRemoteFunction(context, id, __remoteContextToCallWhenFunctionExecutes);
      }
    }
  }
  return { values };
}

export function environmentToJSON(context: ScriptingContext, environment: EnvironmentBase): EnvironmentBase {
  let boundaryEnv = getBoundaryEnv(context);
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
          console.log(v);
          values[k] = v;
        }
      } else if (typeof v === "undefined") {
        references[k] = { id: "undefined" };
      } else {
        values[k] = v;
      }
    }
  }
  return { references, values };
}

export function validateMessage(message: Message): Message {
  if (typeof message.source !== "string" && typeof message.source !== "object") {
    throw new Error("Message should contain `source` value of type string or object.");
  }
  if (message.env && typeof message.env !== "object") {
    throw new Error("Message should contain `env` value of type object.");
  }
  return message;
}

export const getConnectTo = (WebSocketConstructor: typeof WebSocket) => (connectionString: string) =>
  new Promise<ScriptingContext>((resolve, _reject) => {
    const connect = () => {
      let client = new WebSocketConstructor(connectionString);
      let context: ScriptingContext;

      const send = (message: Message) => {
        client.send(JSON.stringify(validateMessage(message)));
      };
      client.addEventListener("close", () => {
        setTimeout(connect, 5000);
      });
      client.addEventListener("message", e => {
        let message = validateMessage(JSON.parse(e.data) as Message);
        console.log("client got message");
        console.log(message);
        if (message.env) {
          let env = environmentFromJSON(context, message.env);
          console.log("env from message");
          console.log(env, JSON.stringify(env));
          metaESEval(message.source, env, { errorCallback: console.log }, env.values["c"], env.values["cerr"]);
        }
      });
      client.addEventListener("open", async () => {
        context = {
          // TODO: should return a promise too
          evaluate: (input: Source, environment?: Environment, c?: SuccessCallback, cerr?: ErrorCallback) =>
            send({
              source: input,
              env: environmentToJSON(context, valuesIntoEnvironment({ c, cerr }, environment))
            })
        };
        resolve(context);
      });
    };
    connect();
  });
