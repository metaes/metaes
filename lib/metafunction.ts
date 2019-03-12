import { evaluate, visitArray } from "./evaluate";
import { Environment } from "./environment";
import { NotImplementedException, toException } from "./exceptions";
import { FunctionNode } from "./nodeTypes";
import { Continuation, ErrorContinuation, EvaluationConfig, MetaesFunction } from "./types";

export const evaluateMetaFunction = (
  metaFunction: MetaesFunction,
  c: Continuation,
  cerr: ErrorContinuation,
  thisObject: any,
  args: any[],
  executionTimeConfig?: EvaluationConfig
) => {
  const { e, closure, config } = metaFunction;
  const env = {
    prev: closure,
    values: { this: thisObject, arguments: args }
  };
  let i = 0;
  visitArray(
    e.params,
    (param, c, cerr) => {
      switch (param.type) {
        case "Identifier":
          c((env.values[param.name] = args[i++]));
          break;
        case "RestElement":
          c((env.values[param.argument.name] = args.slice(i++)));
          break;
        case "ObjectPattern":
          evaluate(param, c, cerr, { values: args[i++], prev: env, internal: true }, config);
          break;
        default:
          cerr(NotImplementedException(`"${param["type"]}" is not supported type of function param.`, param));
      }
    },
    () =>
      evaluate(
        e.body,
        value =>
          // use implicit return only if function is arrow function and have expression as a body
          e.type === "ArrowFunctionExpression" && e.body.type !== "BlockStatement"
            ? c(value)
            : // ignore what was evaluated in function body, return statement in error continuation should carry the value
              c(),
        exception => (exception.type === "ReturnStatement" ? c(exception.value) : cerr(exception)),
        env,
        Object.assign({}, executionTimeConfig, config)
      ),
    cerr
  );
};

export const createMetaFunctionWrapper = (metaFunction: MetaesFunction) => {
  const fn = function(this: any, ...args) {
    let result;
    let exception;
    evaluateMetaFunction(metaFunction, r => (result = r), ex => (exception = toException(ex)), this, args);
    if (exception) {
      throw exception;
    }
    return result;
  };

  markAsMetaFunction(fn, metaFunction);
  return fn;
};

export const createMetaFunction = (e: FunctionNode, closure: Environment, config: EvaluationConfig) =>
  createMetaFunctionWrapper({
    e,
    closure,
    config
  });

const META_KEY = "__meta__";

export function markAsMetaFunction(fn: Function, meta: MetaesFunction) {
  (<any>fn)[META_KEY] = meta;
}

export function isMetaFunction(fn: Function) {
  return (<any>fn)[META_KEY];
}

export function getMetaFunction(fn: Function) {
  return (<any>fn)[META_KEY];
}
