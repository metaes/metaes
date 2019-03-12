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
  internal?: boolean;
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
  let writableEnv: Environment | undefined = env;
  while (writableEnv && writableEnv.internal) {
    writableEnv = writableEnv.prev;
  }
  if (!writableEnv) {
    return cerr(new Error(`Can't write to '${name}' value.`));
  }
  if (isDeclaration) {
    c((writableEnv.values[name] = value));
  } else {
    const _env = getEnvironmentForValue(writableEnv, name);
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
    if (Object.hasOwnProperty.call(_env.values, name)) {
      return c(_env.values[name]);
    }
  } while ((_env = _env.prev));

  cerr({
    type: "ReferenceError",
    value: new ReferenceError(`"${name}" is not defined.`)
  });
}
