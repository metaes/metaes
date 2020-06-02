import { Continuation, ErrorContinuation, EnvironmentBase, Environment } from "./types";

export function toEnvironment(environment?: any | EnvironmentBase | Environment): Environment {
  return environment ? ("values" in environment ? environment : { values: environment }) : { values: {} };
}

export function getEnvironmentBy(env: Environment, condition: (env: Environment) => boolean): Environment | null {
  let _env: Environment | undefined = env;
  while (_env) {
    if (condition(_env)) {
      return _env;
    }
    _env = _env.prev;
  }
  return null;
}

export function getEnvironmentForValue(env: Environment, name: string): Environment | null {
  return getEnvironmentBy(env, env => name in env.values);
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

export function GetValueSync<T>(name: string, env: Environment<T>): T | null {
  let _env: Environment | undefined = env;
  while (_env && _env.values) {
    if (Object.hasOwnProperty.call(_env.values, name)) {
      return _env.values[name];
    }
    _env = _env.prev;
  }
  return null;
}
