import { EvaluationConfig, LocatedError, NotImplementedYet, EvaluationSuccess, EvaluationError } from "./types";
import { evaluate, ReturnStatementValue } from "./applyEval";
import { FunctionNode } from "./nodeTypes";
import { errorShouldBeForwarded } from "./utils";
import { callInterceptor, Environment } from "./environment";

export type MetaFunction = {
  e: FunctionNode;
  closure: Environment;
  config?: EvaluationConfig;
};

const toLocatedError = (any, e?) => (any instanceof LocatedError ? any : new LocatedError(any, e));

// TODO: of "evaluate" should handle metaFunction too?
const evaluateMetaFunction = (
  metaFunction: MetaFunction,
  c: EvaluationSuccess,
  cerr: EvaluationError,
  thisObject: any,
  args: any[]
) => {
  const { e, closure, config } = metaFunction;
  try {
    const env = {
      prev: closure,
      values: { this: thisObject, arguments: args }
    };

    let i = 0;
    for (let param of e.params) {
      switch (param.type) {
        case "Identifier":
          env.values[param.name] = args[i++];
          break;
        case "RestElement":
          env.values[param.argument.name] = args.slice(i);
          break;
        default:
          const error = new LocatedError(
            new NotImplementedYet(`Not supported type (${param["type"]}) of function param.`),
            param
          );
          config && config.onError && config.onError(error);
          throw error;
      }
    }
    config && callInterceptor(e, config, metaFunction, env, "enter");
    let _calledAfterInterceptor = false;

    function _interceptorAfter(e, value, env) {
      if (_calledAfterInterceptor) {
        return;
      }
      config && callInterceptor(e, config, value, env, "exit");
      _calledAfterInterceptor = true;
    }

    evaluate(
      e.body,
      env,
      config,
      result => {
        c(result);
        _interceptorAfter(e, result, env);
      },
      trapOrError => {
        if (trapOrError instanceof ReturnStatementValue) {
          c(trapOrError.value);
          _interceptorAfter(e, trapOrError.value, env);
        } else if (errorShouldBeForwarded(trapOrError)) {
          c(toLocatedError(trapOrError, e));
          _interceptorAfter(e, trapOrError, env);
          throw trapOrError;
        } else {
          _interceptorAfter(e, trapOrError, env);
          const error = toLocatedError(trapOrError, e);
          cerr(error);
        }
      }
    );
  } catch (e) {
    config && config.onError && config.onError(e);
    cerr(e);
  }
};

// TODO: it should probably just take 3 args and create one structure? just for now
export const createMetaFunction = (e: FunctionNode, closure: Environment, config: EvaluationConfig) => {
  const metaFunction = { e, closure, config };
  // this is just JS interoperability streamlining
  return function __metaFunction(this: any, ...args) {
    let result;
    evaluateMetaFunction(
      metaFunction,
      r => {
        result = r;
      },
      e => {
        throw e;
      },
      this,
      args
    );
    return result;
  };
};
