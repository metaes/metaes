import { EvaluationConfig, MetaesFunction, Continuation, ErrorContinuation } from "./types";
import { NotImplementedException } from "./exceptions";
import { evaluate } from "./applyEval";
import { callInterceptor, Environment } from "./environment";
import { FunctionNode } from "./nodeTypes";

export const evaluateMetaFunction = (
  metaFunction: MetaesFunction,
  c: Continuation,
  cerr: ErrorContinuation,
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
          const error = NotImplementedException(`Not supported type (${param["type"]}) of function param.`, param);
          config && config.onError && config.onError(error);
          throw error;
      }
    }
    config && callInterceptor({ phase: "enter" }, config, e, env, metaFunction);
    let _calledAfterInterceptor = false;

    function _interceptorAfter(e, value, env) {
      if (_calledAfterInterceptor) {
        return;
      }
      config && callInterceptor({ phase: "exit" }, config, e, env, value);
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
      exception => {
        switch (exception.type) {
          case "ReturnStatement":
            c(exception.value);
            break;
          default:
            if (!exception.location) {
              exception.location = e;
            }
            cerr(exception);
        }
        _interceptorAfter(e, exception.value, env);
      }
    );
  } catch (e) {
    cerr(e);
  }
};

export const createMetaFunctionWrapper = (metaFunction: MetaesFunction) =>
  function(this: any, ...args) {
    let result;
    let error;
    evaluateMetaFunction(
      metaFunction,
      r => (result = r),
      exception => {
        error = exception.value || exception;
      },
      this,
      args
    );
    if (error) {
      if (metaFunction.config.onError) {
        metaFunction.config.onError(error);
      } else {
        throw error;
      }
    }
    return result;
  };

export const createMetaFunction = (e: FunctionNode, closure: Environment, config: EvaluationConfig) =>
  createMetaFunctionWrapper({
    e,
    closure,
    config
  });
