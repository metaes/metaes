import { ScriptingContext, Source } from './metaes';
import { EnvironmentBase, Environment } from './environment';

declare let Object: {
  entries: Function;
};

export type Message = { source: Source; env?: EnvironmentBase };

export function environmentFromJSON(context: ScriptingContext, environment?: EnvironmentBase): Environment {
  if (environment && environment.references) {
    for (let [k, v] of Object.entries(environment.references)) {
      console.log(k, v);
    }
  }
}

export function environmentToJSON(context: ScriptingContext, environment: EnvironmentBase): EnvironmentBase {
  Object.entries(environment.values).forEach(([k, v]) => {});
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
