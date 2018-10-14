import { Continuation, ErrorContinuation } from "./types";

export interface Reference {
  id?: string;
}

export interface EnvironmentBase<T = any> {
  values: { [key: string]: T };
  references?: { [key: string]: Reference };
}

export interface Environment<T = any> extends EnvironmentBase<T> {
  prev?: Environment<T>;
}

export function toEnvironment(environment?: any | EnvironmentBase | Environment): Environment {
  return environment ? ("values" in environment ? environment : { values: environment }) : { values: {} };
}

export function getEnvironmentForValue(env: Environment, name: string): Environment | null {
  let _env: Environment | undefined = env;
  while (_env) {
    if (name in _env.values) {
      return _env;
    }
    _env = _env.prev;
  }
  return null;
}

type SetValueT<T> = {
  name: string;
  value: T;
  isDeclaration: boolean;
};

export function SetValue<T>(
  { name, value, isDeclaration }: SetValueT<T>,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment<T>
) {
  if (isDeclaration) {
    c((env.values[name] = value));
  } else {
    const _env = getEnvironmentForValue(env, name);
    if (_env) {
      c((_env.values[name] = value));
    } else {
      cerr({ type: "ReferenceError", value: new ReferenceError(`'${name}' is not defined.`) });
    }
  }
}

export function GetValue<T>(
  { name }: { name: string },
  c: Continuation<T>,
  cerr: ErrorContinuation,
  env: Environment<T>
) {
  let _env: Environment | undefined = env;
  do {
    if (!_env) {
      break;
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
}
