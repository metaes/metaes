import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";
import { tokens } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { Environment } from "./environment";
import { NotImplementedException } from "./exceptions";
import { callInterceptor } from "./metaes";

export function evaluateProp(
  propertyKey: string,
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  callInterceptor({ phase: "enter", propertyKey }, config, e);

  const value = e[propertyKey];
  const createContinuation = (cnt, value) => {
    callInterceptor({ phase: "exit", propertyKey }, config, e, env);
    cnt(value);
  };
  const _c = createContinuation.bind(null, c);
  const _cerr = createContinuation.bind(null, cerr);

  Array.isArray(value) ? evaluateArray(value, env, config, _c, _cerr) : evaluate(value, env, config, _c, _cerr);
}

// TODO: DRY
export function evaluatePropWrap(
  propertyKey: string,
  body: (c: Continuation, cerr: ErrorContinuation) => void,
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  callInterceptor({ phase: "enter", propertyKey }, config, e, env);

  body(
    value => {
      callInterceptor({ phase: "exit", propertyKey }, config, e, env);
      c(value);
    },
    exception => {
      callInterceptor({ phase: "exit", propertyKey }, config, e, env);
      cerr(exception);
    }
  );
}

export function evaluate(
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  if (e.type in tokens) {
    callInterceptor({ phase: "enter" }, config, e, env);
    try {
      tokens[e.type](
        e,
        env,
        config,
        value => {
          callInterceptor({ phase: "exit" }, config, e, env, value);
          c(value);
        },
        exception => {
          if (!exception.location) {
            exception.location = e;
          }
          callInterceptor({ phase: "exit" }, config, e, env, exception);
          cerr(exception);
        }
      );
    } catch (error) {
      throw error;
    }
  } else {
    const exception = NotImplementedException(`"${e.type}" node type interpreter is not defined yet.`, e);
    callInterceptor({ phase: "enter" }, config, e, env);
    cerr(exception);
    callInterceptor({ phase: "enter" }, config, e, env, exception);
  }
}

type Visitor<T> = (element: T, c: Continuation, cerr: ErrorContinuation) => void;

export const visitArray = <T>(items: T[], fn: Visitor<T>, c: Continuation, cerr: ErrorContinuation) =>
  (function loop(index, accumulated: T[]) {
    if (index < items.length) {
      fn(
        items[index],
        value => {
          accumulated.push(value);
          loop(index + 1, accumulated);
        },
        cerr
      );
    } else {
      c(accumulated);
    }
  })(0, []);

export const evaluateArray = (
  array: ASTNode[],
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => visitArray(array, (e, c, cerr) => evaluate(e, env, config, c, cerr), c, cerr);

export const apply = (fn: Function, thisObj: any, args: any[]) => fn.apply(thisObj, args);
