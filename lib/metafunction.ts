import { EvaluationConfig, LocatedError, NotImplementedYet } from "./types";
import { evaluate, ReturnStatementValue } from "./applyEval";
import { FunctionNode } from "./nodeTypes";
import { errorShouldBeForwarded } from "./utils";
import { callInterceptor, Environment } from "./environment";

export let createMetaFunction = (e: FunctionNode, closure: Environment, config: EvaluationConfig) =>
  function __metaFunction(this: any, ...args) {
    try {
      let env = {
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
            let error = new LocatedError(
              new NotImplementedYet(`Not supported type (${param["type"]}) of function param.`),
              param
            );
            config.errorCallback && config.errorCallback(error);
            throw error;
        }
      }
      let result;
      callInterceptor(e, config, __metaFunction, env, "enter");

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
            config.errorCallback(
              trapOrError instanceof LocatedError ? trapOrError : new LocatedError(trapOrError, e)
            );
          }
        }
      );
      _interceptorAfter(e, result, env);
      return result;
    } catch (e) {
      config.errorCallback(e);
      throw e;
    }
  };
