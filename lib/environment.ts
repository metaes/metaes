import { Continuation, ErrorContinuation } from "./types";

export interface Reference {
  id?: string;
}

export interface EnvironmentBase<T = any> {
  values: { [key: string]: T };
  tags?: { [key: string]: any };
  references?: { [key: string]: Reference };
}

export interface Environment<T = any> extends EnvironmentBase<T> {
  prev?: Environment<T>;
}

export function toEnvironment(environment?: any | EnvironmentBase | Environment): Environment {
  return environment ? ("values" in environment ? environment : { values: environment }) : { values: {} };
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

export function setValue<T>(
  env: Environment<T>,
  name: string,
  value: T,
  isDeclaration: boolean,
  c: Continuation,
  cerr: ErrorContinuation
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

export function getValue<T>(env: Environment<T>, name: string, c: Continuation<T>, cerr: ErrorContinuation) {
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

export function setValueTag(env: Environment, name: string, tagKey: string, tagValue: any) {
  const _env = getEnvironmentForValue(env, name);
  if (_env) {
    _env.tags = _env.tags || {};
    _env.tags[name] = _env.tags[name] || {};
    _env.tags[name][tagKey] = tagValue;
  } else {
    throw new Error(`Couldn't find environment for ${name} value`);
  }
}

export function deleteValueTag(env: Environment, valueName: string, tagKey: string) {
  const _env = getEnvironmentForValue(env, valueName);
  if (_env) {
    try {
      delete _env.tags![valueName][tagKey];
    } catch {
      // ignore
    }
  }
}

export function getValueTag(env: Environment, name: string, key: string) {
  const _env = getEnvironmentForValue(env, name);
  if (_env) {
    try {
      return _env.tags![name][key];
    } catch {
      return null;
    }
  }
}
