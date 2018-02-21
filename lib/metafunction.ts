import { EvaluationConfig, LocatedError, NotImplementedYet } from "./types";
import { evaluate, ReturnStatementValue } from "./applyEval";
import { FunctionNode } from "./nodeTypes";
import { errorShouldBeForwarded } from "./utils";
import { callInterceptor, Environment } from "./environment";

export type MetaFunction = {
  e: FunctionNode;
  closure: Environment;
  config: EvaluationConfig;
};

export const createMetaFunction = (metaFunction: MetaFunction) => {
  const { e, closure, config } = metaFunction;
  return function metaFunction(this: any, ...args) {
    try {
      const env = {
        prev: closure,
        values: { this: this, arguments: args }
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
            config.onError && config.onError(error);
            throw error;
        }
      }
      let result;
      callInterceptor(e, config, metaFunction, env, "enter");

      let _calledAfterInterceptor = false;

      function _interceptorAfter(e, value, env) {
        if (_calledAfterInterceptor) {
          return;
        }
        callInterceptor(e, config, value, env, "exit");
        _calledAfterInterceptor = true;
      }

      evaluate(
        e.body,
        env,
        config,
        r => {
          result = r;
          _interceptorAfter(e, result, env);
        },
        trapOrError => {
          if (trapOrError instanceof ReturnStatementValue) {
            result = trapOrError.value;
            _interceptorAfter(e, result, env);
          } else if (errorShouldBeForwarded(trapOrError)) {
            _interceptorAfter(e, result, env);
            throw trapOrError;
          } else {
            config.onError &&
              config.onError(trapOrError instanceof LocatedError ? trapOrError : new LocatedError(trapOrError, e));
          }
        }
      );
      _interceptorAfter(e, result, env);
      return result;
    } catch (e) {
      config.onError && config.onError(e);
      // TODO: maybe should be restored
      // TODO: throw if run from bare JS, don't if from metaes
      // throw e;
    }
  };
};
