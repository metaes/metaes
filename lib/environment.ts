import { Continuation, ErrorContinuation, EvaluationConfig, EvaluationType } from "./types";
import { Identifier } from "./nodeTypes";
import { ASTNode } from "./nodes/nodes";

export class EnvNotFoundError extends Error {}

export interface EnvironmentBase {
  values: { [key: string]: any };
  references?: { [key: string]: Reference };
}

export interface Environment extends EnvironmentBase {
  prev?: Environment;

  // At the moment used only for CatchClause.
  // Intended not to be available for client JavaScript programs
  internal?: Environment;
}

export function callInterceptor(e: ASTNode, config: EvaluationConfig, env: Environment, type: EvaluationType, value?) {
  config.interceptor &&
    config.interceptor({
      e,
      value: e.type === "Identifier" ? getValueOrReference((e as Identifier).name, env, config, value) : value,
      env,
      type,
      timestamp: new Date().getTime(),
      scriptId: config.scriptId || ""
    });
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

export interface Reference {
  name?: string;
  value?: any;
  id?: string;
  native?: boolean;
}

// TODO: verify if it's really needed
export const setValueAndCallAfterInterceptor = (
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  name: string,
  value: any,
  isDeclaration: boolean,
  c: Continuation,
  cerr: ErrorContinuation
) =>
  setValue(
    env,
    name,
    value,
    isDeclaration,
    value => {
      callInterceptor(e, config, env, "exit", getValueOrReference(name, env, config, value));
      c(value);
    },
    cerr
  );

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
    setReference(env, name, value, isDeclaration);
    c((env.values[name] = value));
  } else {
    while (_env) {
      // TODO: TS shouldn't complain here, should he?
      if (name in <any>_env.values) {
        // TODO: set reference value as well
        setReference(env, name, value, false);
        c((_env.values[name] = value));
        return;
      }
      _env = _env.prev;
    }
    cerr(new EnvNotFoundError());
  }
}

type Container = {
  env: Environment;
  name: string;
  value: any;
};

// TODO: remove do/while loop and use recursion?
function _getValue(
  env: Environment,
  name: string,
  returnWithContainer: boolean = false,
  c: (container: Container) => void,
  cerr: ErrorContinuation
) {
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
    if (name in <any>_env.values) {
      let value = _env.values[name];

      // return required here to avoid calling `cerr` at the end
      return c(returnWithContainer ? { env: _env, name, value } : value);
    }
  } while ((_env = _env.prev));

  cerr({ type: "ReferenceError", value: new ReferenceError(`"${name}" is not defined.`) });
}

export const getValue = (env: Environment, name: string, c: Continuation, cerr: ErrorContinuation) =>
  _getValue(env, name, false, c, cerr);

function setReference(env: Environment, name: string, value: any, native: boolean) {
  if (!env.references) {
    env.references = {};
  }

  let reference = env.references[name];
  if (!reference) {
    reference = { name, value, native };
    env.references[name] = reference;
    reference.value = value;
  }
  return reference;
}

export const getReference = (
  env: Environment,
  name: string,
  c: (reference: Reference) => void,
  cerr: ErrorContinuation
) =>
  _getValue(
    env,
    name,
    true,
    ({ env, name, value }) => {
      if (!env.references) {
        env.references = {};
      }
      c(env.references[name] || setReference(env, name, value, false));
    },
    cerr
  );

/**
 * Utility allowing to avoid CPS overhead.
 * Use for reporting to interceptor only.
 */
export function getReferenceSync(env: Environment, name: string) {
  let result, error;
  getReference(env, name, _result => (result = _result), _error => (error = _error));
  // ignore error, because it's only for reporting
  return result;
}

/**
 * Use for reporting to interceptor.
 */
export const getValueOrReference = (name: string, env: Environment, config: EvaluationConfig, value): Reference | any =>
  config.useReferences ? getReferenceSync(env, name) : value;
