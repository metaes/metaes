import { Environment } from 'metaes/environment';
import { Continuation, ErrorContinuation, EvaluationConfig, EvaluationType, MetaESError } from './types';
import { Identifier } from './nodeTypes';
import { ASTNode } from './nodes/nodes';

export class EnvNotFoundError extends Error {}

export interface EnvironmentData {
  values: object;
  references?: { [key: string]: Reference };
}

export interface Environment extends EnvironmentData {
  prev?: Environment;

  // At the moment used only for CatchClause.
  // Intended not to be available for client JavaScript programs
  internal?: Environment;
}

export function callInterceptor(e: ASTNode, config: EvaluationConfig, value, env: Environment, type: EvaluationType) {
  config.interceptor &&
    config.interceptor({
      e,
      value: e.type === 'Identifier' ? getValueOrReference((e as Identifier).name, env, config, value) : value,
      env,
      type,
      timestamp: new Date().getTime(),
    });
}

export interface Reference {
  name: string;
  value: any;
  createdByMetaES: boolean;
}

export class ReferenceCtor implements Reference {
  get createdByMetaES(): boolean {
    return this._createdByMetaES;
  }

  constructor(
    public name: string,
    public value: any,
    public environment: Environment,
    private _createdByMetaES: boolean
  ) {}
}

export function deserializeEnvironment(environment: EnvironmentData): Environment {}

// TODO: verify if it's really needed
export function setValueAndCallAfterInterceptor(
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  name: string,
  value: any,
  isDeclaration: boolean,
  c: Continuation,
  cerr: ErrorContinuation
) {
  setValue(
    env,
    name,
    value,
    isDeclaration,
    value => {
      callInterceptor(e, config, getValueOrReference(name, env, config, value), env, 'exit');
      c(value);
    },
    cerr
  );
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
    setReference(env, name, value, isDeclaration);
    c((env.values[name] = value));
  } else {
    while (_env) {
      // TODO: TS shouldn't complain here, should he?
      if (name in (<any>_env.values)) {
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
      } catch (e) {
        return cerr(new MetaESError(e));
      }
    }
    // TODO: TS shouldn't complain here, no?
    if (name in (<any>_env.values)) {
      let value = _env.values[name];

      // return required here to avoid calling `cerr` at the end
      return c(returnWithContainer ? { env: _env, name, value } : value);
    }
  } while ((_env = _env.prev));

  cerr(new ReferenceError(`"${name}" is not defined.`));
}

function setReference(env: Environment, name: string, value: any, createdByMetaES: boolean) {
  if (!env.references) {
    env.references = {};
  }

  let reference = env.references[name];
  if (!reference) {
    reference = new ReferenceCtor(name, value, env, createdByMetaES);
    env.references[name] = reference;
    reference.value = value;
  }
  return reference;
}

export function getReference(
  env: Environment,
  name: string,
  c: (reference: Reference) => void,
  cerr: ErrorContinuation
) {
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
}

/**
 * Utility allowing to avoid CPS overhead.
 * Use for reporting to interceptor only.
 */
export function getReferenceNonCPS(env: Environment, name: string) {
  let result, error;
  getReference(env, name, _result => (result = _result), _error => (error = _error));
  // ignore error, because it's only for reporting
  return result;
}

/**
 * Use for reporting to interceptor.
 */
export function getValueOrReference(name: string, env: Environment, config: EvaluationConfig, value): Reference | any {
  if (config.useReferences) {
    return getReferenceNonCPS(env, name);
  } else {
    return value;
  }
}

export function getValue(env: Environment, name: string, c: Continuation, cerr: ErrorContinuation) {
  _getValue(env, name, false, c, cerr);
}
