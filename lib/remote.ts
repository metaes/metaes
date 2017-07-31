import { ScriptingContext, Source, metaESEval } from './metaes';
import { EnvironmentBase, Environment, valuesIntoEnvironment } from './environment';
import { SuccessCallback, ErrorCallback } from './types';

const boundaryEnvironments = new Map<ScriptingContext, Map<object | Function, string>>();

function pairs(o: object) {
  let result: any[] = [];
  for (let k of Object.keys(o)) {
    result.push([k, o[k]]);
  }
  return result;
}

const boundaryEnvironmentFor = (context: ScriptingContext) => {
  let env = boundaryEnvironments.get(context);
  if (!env) {
    boundaryEnvironments.set(context, (env = new Map()));
    return env;
  }
  return env;
};

export type Message = { source: Source; env?: EnvironmentBase };

// TODO: solve function vs object problem
function createRemoteFunction(context: ScriptingContext, id: string) {
  let boundary = boundaryEnvironmentFor(context);
  let fn = () => {
    throw new Error(`Can't call this function yet, use 'context.valuate' using this value.`);
  };
  boundary.set(fn, id);
  return fn;
}

export function environmentFromJSON(context: ScriptingContext, environment: EnvironmentBase): Environment {
  let boundaryEnv = boundaryEnvironmentFor(context);
  let values = environment.values || {};
  if (environment.references) {
    outer: for (let [key, { id }] of pairs(environment.references)) {
      for (let [value, boundaryId] of boundaryEnv.entries()) {
        if (boundaryId === id) {
          values[key] = value;
          continue outer;
        }
      }
      // TODO: don't know yet if it's function or object. Solve this ambiguity
      values[key] = createRemoteFunction(context, id);
    }
  }
  return { values };
}

export function environmentToJSON(context: ScriptingContext, environment: EnvironmentBase): EnvironmentBase {
  let boundaryEnv = boundaryEnvironmentFor(context);
  let references: { [key: string]: { id: string } } = {};
  let values = {};

  for (let [k, v] of pairs(environment.values)) {
    if (k) {
      if (typeof v === 'function' || typeof v === 'object') {
        if (!boundaryEnv.has(v)) {
          boundaryEnv.set(v, Math.random() + '');
        }
        references[k] = { id: boundaryEnv.get(v)! };
      } else {
        values[k] = v;
      }
    }
  }
  return { references, values };
}

export function validateMessage(message: Message): Message {
  if (typeof message.source !== 'string') {
    throw new Error('Message should contain `script` value of type string.');
  }
  if (message.env && typeof message.env !== 'object') {
    throw new Error('Message should contain `env` value of type object.');
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
      client.addEventListener('close', () => {
        setTimeout(connect, 5000);
      });
      client.addEventListener('message', e => {
        let message = validateMessage(JSON.parse(e.data) as Message);
        if (message.env) {
          let env = environmentFromJSON(context, message.env);
          metaESEval(
            message.source,
            env,
            { errorCallback: console.log.bind(console) },
            env.values['c'],
            env.values['cerr']
          );
        }
      });
      client.addEventListener('open', async () => {
        context = {
          // TODO: should return a promise too
          evaluate: (input: Source, environment?: Environment, c?: SuccessCallback, cerr?: ErrorCallback) =>
            send({
              source: input,
              env: environmentToJSON(context, valuesIntoEnvironment({ c, cerr }, environment)),
            }),
        };
        resolve(context);
      });
    };
    connect();
  });
