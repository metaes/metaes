import { toException } from "./exceptions";
import { GetValueT, SetValueT } from "./nodeTypes";
import { Continuation, Environment, EnvironmentBase, PartialErrorContinuation } from "./types";

type EnvironmentLike = EnvironmentBase | Environment | any;

export function isEnvironment(env: EnvironmentLike): env is Environment {
  return typeof env === "object" && "values" in env;
}

export function toEnvironment(environment?: EnvironmentLike): Environment {
  return environment ? (isEnvironment(environment) ? environment : { values: environment }) : { values: {} };
}

export function createEnvironment(environmentLike: EnvironmentLike, prev?: EnvironmentLike) {
  return { ...toEnvironment(environmentLike), ...{ prev: prev && toEnvironment(prev) } };
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
  return getEnvironmentBy(env, (env) => name in env.values);
}

export function SetValue<T>(
  { name, value, isDeclaration }: Omit<SetValueT<T>, "type">,
  c: Continuation,
  cerr: PartialErrorContinuation,
  env: Environment<T>
) {
  let writableEnv: Environment | undefined = env;
  while (writableEnv && writableEnv.internal) {
    writableEnv = writableEnv.prev;
  }
  if (!writableEnv) {
    return cerr(toException(new Error(`Can't write to '${name}' value.`)));
  }
  if (isDeclaration) {
    c((writableEnv.values[name] = value));
  } else {
    const _env = getEnvironmentForValue(writableEnv, name);
    if (_env) {
      c((_env.values[name] = value));
    } else {
      cerr({ type: "Error", value: new ReferenceError(`'${name}' is not defined.`) });
    }
  }
}

export function GetValue<T>(
  { name }: Omit<GetValueT, "type">,
  c: Continuation<T>,
  cerr: PartialErrorContinuation,
  env: Environment<T>
) {
  let _env: Environment | undefined = env;
  do {
    if (Object.hasOwnProperty.call(_env.values, name)) {
      return c(_env.values[name]);
    }
  } while ((_env = _env.prev));

  cerr({
    type: "Error",
    value: new ReferenceError(`"${name}" is not defined.`)
  });
}

export const createInternalEnv = (values: object, prev?: Environment) =>
  <const>{ ...createEnvironment(values, prev), internal: true };
