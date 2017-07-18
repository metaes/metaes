import {ScriptingContext} from "./metaes";
import {EnvironmentData, Environment} from "./environment";

declare let Object: {
  entries: Function;
};

export function environmentFromJSON(environmentData: EnvironmentData, context: ScriptingContext): Environment {
  if (environmentData.references) {
    for (let [k, v] of Object.entries(environmentData.references)) {
      console.log(k,v);
    }
  }
}

export function environmentToJSON(environment: Environment): EnvironmentData {}