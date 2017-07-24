import { parse } from './parse';
import { ErrorCallback, EvaluationConfig, LocatedError, SuccessCallback } from './types';
import { evaluate } from './applyEval';
import { ASTNode } from './nodes/nodes';
import { Environment, EnvironmentBase } from './environment';

const log = e => console.log(e);

export type Source = string | ASTNode;

export interface ScriptingContext {
  evaluate(
    source: Source | Function,
    extraEnvironment?: EnvironmentBase,
    c?: SuccessCallback,
    cerr?: ErrorCallback
  ): any | undefined;
}

export class MetaESContext implements ScriptingContext {
  constructor(
    public environment: Environment = { values: {} },
    public config: EvaluationConfig = { errorCallback: log },
    public c?: SuccessCallback,
    public cerr?: ErrorCallback
  ) {}

  evaluate(
    source: Source | Function,
    extraEnvironment?: EnvironmentBase,
    c?: SuccessCallback,
    cerr?: ErrorCallback
  ): any | undefined {
    let env = this.environment;
    if (extraEnvironment) {
      env = Object.assign({ prev: this.environment }, extraEnvironment);
    }
    return metaESEval(source, env, this.config, c || this.c, cerr || this.cerr);
  }
}

export const evaluatePromisified = (
  context: ScriptingContext,
  source: Source | Function,
  environment?: EnvironmentBase
) =>
  new Promise<any>((resolve, reject) =>
    context.evaluate(source, environment, success => resolve(success.value), error => reject(error.originalError))
  );

export function consoleLoggingMetaESContext(environment: Environment = { values: {} }) {
  return new MetaESContext(
    environment,
    {
      interceptor: evaluation => {
        console.log(evaluation);
      },
      errorCallback: (e: LocatedError) => {
        console.log(e);
      },
    },
    value => {
      console.log(value);
    },
    e => console.log(e)
  );
}

let VMsCounter = 0;

export function metaESEval(
  source: Source | Function,
  environment: Environment | object = {},
  config: EvaluationConfig = { errorCallback: log },
  c?: SuccessCallback,
  cerr?: ErrorCallback
): any | undefined {
  config.name = config.name || 'VM' + VMsCounter++;

  try {
    let node: ASTNode = (typeof source === 'object'
        ? source
        : parse(typeof source === 'function' ? '(' + source.toString() + ')' : source)) as ASTNode,
      env: Environment;

    if ('values' in environment) {
      env = environment as Environment;
    } else {
      env = {
        prev: undefined,
        values: environment,
      };
    }
    env.values['this'] = env.values;

    let value = Symbol('No value assigned');
    evaluate(
      node,
      env,
      config,
      val => {
        value = val;
        if (c) {
          c({ node, value: val });
        }
      },
      error => cerr && cerr(error instanceof LocatedError ? error : new LocatedError(node, error))
    );
    return value;
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
}
