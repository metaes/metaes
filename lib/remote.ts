import { ScriptingContext, Source } from './metaes';
import { EnvironmentData, Environment } from './environment';

declare let Object: {
  entries: Function;
};

export type Message = { script: Source; env?: EnvironmentData };

export function environmentFromJSON(context: ScriptingContext, environmentData?: EnvironmentData): Environment {
  if (environmentData && environmentData.references) {
    for (let [k, v] of Object.entries(environmentData.references)) {
      console.log(k, v);
    }
  }
}

export function environmentToJSON(environment: Environment): EnvironmentData {}

export function validateMessage(message: Message): Message {
  if (typeof message.script !== 'string') {
    throw new Error('Message should contain `script` value of type string.');
  }
  if (message.env && typeof message.env !== 'object') {
    throw new Error('Message should contain `env` value of type object.');
  }
  return message;
}
