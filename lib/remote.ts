import { ScriptingContext, Source } from './metaes';
import { EnvironmentBase, Environment } from './environment';

const boundaries = new Map<ScriptingContext, object>();
const boundaryFor = (context: ScriptingContext) => {
  let values = boundaries.get(context);
  if (!values) {
    boundaries.set(context, (values = {}));
    return values;
  }
  return values;
};

export type Message = { source: Source; env?: EnvironmentBase };

export function environmentFromJSON(context: ScriptingContext, environment?: EnvironmentBase): Environment {
  if (environment && environment.references) {
    for (let k of Object.keys(environment.values)) {
      let v = environment.values[k];
      console.log('fromjson', k, v);
    }
  }
}

export function environmentToJSON(context: ScriptingContext, environment: EnvironmentBase): EnvironmentBase {
  let boundary = boundaryFor(context);

  // store references as values
  for (let k of Object.keys(environment.values)) {
    let v = environment.values[k];
    if (typeof v === 'function') {
      for (let referenceKey of Object.keys(boundary)) {
        let referenceValue = boundary[referenceKey];
        if (v === referenceValue) {
        }
      }
    }
    console.log('tojson', k, v);
  }
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
