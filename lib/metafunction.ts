import { createInternalEnv } from "./environment";
import { evaluate, getTrampolineScheduler, visitArray } from "./evaluate";
import { NotImplementedException } from "./exceptions";
import { ObjectPatternTarget } from "./interpreter/statements";
import { uncps, Upgradable, upgraded } from "./metaes";
import { Continuation, ErrorContinuation, EvaluationConfig, MetaesFunction } from "./types";

const MetaFunction = Symbol.for("[[MetaFunction]]");
export const isMetaFunction = (fn?: Function) => fn && !!fn[MetaFunction];
export const getMetaFunction = (fn: Function): MetaesFunction => fn[MetaFunction];

export const evaluateMetaFunction = (
  { metaFunction, thisObject, args }: { metaFunction: MetaesFunction; thisObject: any; args: any[] },
  c: Continuation,
  cerr: ErrorContinuation,
  executionTimeConfig?: Upgradable<EvaluationConfig>
) => {
  const { e, closure, config } = metaFunction;
  const env = {
    prev: closure,
    values: { this: thisObject, arguments: args }
  };

  let i = 0;
  visitArray(
    e.params,
    function nextMetaFunctionParam(param, c, cerr) {
      switch (param.type) {
        case "Identifier":
          c((env.values[param.name] = args[i++]));
          break;
        case "RestElement":
          c((env.values[param.argument.name] = args.slice(i++)));
          break;
        case "ObjectPattern":
          evaluate(param, c, cerr, createInternalEnv({ [ObjectPatternTarget]: args[i++] }, env), config);
          break;
        case "AssignmentPattern":
          const arg = args[i++];

          if (typeof arg === "undefined") {
            evaluate(param.right, (value) => c((env.values[param.left.name] = value)), cerr, env, config);
          } else {
            c((env.values[param.left.name] = arg));
          }
          break;
        default:
          cerr(NotImplementedException(`"${param["type"]}" is not supported type of function param.`, param));
      }
    },
    () =>
      evaluate(
        e.body,
        (value) =>
          e.type === "ArrowFunctionExpression" && e.body.type !== "BlockStatement"
            ? // use implicit return only if function is arrow function and have expression as a body
              c(value)
            : // ignore what was evaluated in function body, return statement in error continuation should carry the value
              c(undefined),
        function (exception) {
          if (exception.type === "ReturnStatement") {
            c(exception.value);
          } else {
            cerr(exception);
          }
        },
        env,
        upgraded(config, executionTimeConfig)
      ),
    cerr
  );
};

export const createMetaFunctionWrapper = (metaFunction: MetaesFunction) => {
  const fn = function (this: any, ...args) {
    try {
      return uncps(evaluateMetaFunction)({ metaFunction, thisObject: this, args }, (superConfig) => ({
        ...superConfig,
        schedule: getTrampolineScheduler()
      }));
    } catch (exception) {
      throw exception.value;
    }
  };

  if (metaFunction.e.type === "FunctionExpression" && metaFunction.e.id) {
    metaFunction = {
      ...metaFunction,
      closure: { values: { [metaFunction.e.id.name]: fn }, prev: metaFunction.closure }
    };
  }
  fn[MetaFunction] = metaFunction;
  return fn;
};
