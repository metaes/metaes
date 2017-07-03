import {parse} from "./parse";
import {ErrorCallback, EvaluationConfig, LocatedError, SuccessCallback} from "./types";
import {evaluate} from "./applyEval";
import {ASTNode} from "../nodes/nodes";
import {Environment} from "./environment";


function noop(..._args) {
}

export interface ScriptingContext {
  evaluate(input: string | Function | ASTNode): any | undefined;
}

export class MetaESContext implements ScriptingContext {
  constructor(public environment: Environment | object = {},
              public config: EvaluationConfig = {errorCallback: noop},
              public c?: SuccessCallback,
              public cerr?: ErrorCallback) {
  }

  evaluate(input: string | Function | ASTNode): any | undefined {
    return metaESEval(input, this.environment, this.config, this.c, this.cerr);
  }
}

export function consoleLoggingMetaESContext(environment: Environment | object = {}) {
  return new MetaESContext(environment,
    {
      interceptor: (evaluation) => {
        console.log(evaluation);
      },
      errorCallback: (e: LocatedError) => {
        console.log(e);
      }
    },
    value => {
      console.log(value);
    },
    e => console.log(e));
}

let VMsCounter = 0;

export function metaESEval(input: string | Function | ASTNode,
                           environment: Environment | object = {},
                           config: EvaluationConfig = {errorCallback: noop},
                           c?: SuccessCallback,
                           cerr?: ErrorCallback): any | undefined {
  config.name = config.name || "VM" + VMsCounter++;

  try {
    let
      node: ASTNode = (
        (typeof input === 'object') ?
          input :
          parse(typeof input === "function" ? ("(" + input.toString() + ")") : input)) as ASTNode,
      env: Environment;

    if ('names' in <any>environment) {
      env = environment as Environment;
    } else {
      env = {
        prev: undefined,
        names: environment
      };
    }
    env.names['this'] = env.names;

    let value = Symbol('No value assigned');
    evaluate(node, env, config,
      val => {
        value = val;
        if (c) {
          c({node, value: val})
        }
      },
      error => cerr && cerr(error instanceof LocatedError ? error : new LocatedError(node, error)));
    return value;
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
}
