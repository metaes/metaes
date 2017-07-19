import { ScriptingContext, Source } from './metaes';
import { EnvironmentBase, Environment } from './environment';

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
  for (let k of Object.keys(environment.values)) {
    let v = environment.values[k];
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
