import { Continuation, ErrorContinuation, EvaluationConfig, EvaluationTag } from "./types";
import { ASTNode } from "./nodes/nodes";

export interface Reference {
  id?: string;
}

export interface EnvironmentBase {
  values: { [key: string]: any };
  references?: { [key: string]: Reference };
}

export interface Environment extends EnvironmentBase {
  prev?: Environment;
}

export const callInterceptor = (tag: EvaluationTag, config: EvaluationConfig, e: ASTNode, env?: Environment, value?) =>
  config.interceptor({ scriptId: config.scriptId, e, tag, value, timestamp: new Date().getTime(), env });

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

export function setValue(
  env: Environment,
  name: string,
  value: any,
  isDeclaration: boolean,
  c: Continuation,
  cerr: ErrorContinuation
) {
  let _env: Environment | undefined = env;
  if (isDeclaration) {
    c((env.values[name] = value));
  } else {
    while (_env) {
      if (name in _env.values) {
        return c((_env.values[name] = value));
      }
      _env = _env.prev;
    }
    cerr({ message: "environment not found" });
  }
}

export const getValue = (env: Environment, name: string, c: Continuation, cerr: ErrorContinuation) => {
  let _env: Environment | undefined = env;
  do {
    if (!_env) {
      break;
    }
    if (_env.values === null || typeof _env.values === undefined) {
      try {
        _env.values[name]; // force error to be thrown
      } catch (error) {
        cerr({ value: error });
        break;
      }
    }
    if (name in _env.values) {
      let value = _env.values[name];

      // return required here to avoid calling `cerr` at the end
      return c(value);
    }
  } while ((_env = _env.prev));

  cerr({ type: "ReferenceError", value: new ReferenceError(`"${name}" is not defined.`) });
};
