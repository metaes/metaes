import { Continuation, ErrorContinuation } from "./types";

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

export function toEnvironment(environment?: any | EnvironmentBase | Environment): Environment {
  return environment ? ("values" in environment ? environment : { values: environment }) : { values: {} };
}

export function cloneEnvironment(environment?: Environment, topEnvironment?: Environment) {
  if (!environment) {
    throw new Error(`Can't clone falsy value`);
  }
  if (environment.prev) {
    return { values: environment.values, prev: cloneEnvironment(environment.prev) };
  } else {
    const env: Environment = { values: environment.values };
    if (topEnvironment) {
      env.prev = topEnvironment;
    }
    return env;
  }
}

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
        // Use `return` to exit loop and whole function.
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

  cerr({
    type: "ReferenceError",
    value: new ReferenceError(`"${name}" is not defined.`)
  });
};
