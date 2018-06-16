import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";
import { tokens } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { callInterceptor, Environment } from "./environment";
import { NotImplementedException } from "./exceptions";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", event => console.log(event));
}

export const evaluateProp = (
  propertyKey: string,
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => {
  callInterceptor({ phase: "enter", propertyKey }, config, e);

  const value = e[propertyKey];
  const createContinuation = (phase, cnt) => value => (callInterceptor({ phase, propertyKey }, config, e), cnt(value));
  const _c = createContinuation("exit", c);
  const _cerr = createContinuation("exit", cerr);

  Array.isArray(value) ? evaluateArray(value, env, config, _c, _cerr) : evaluate(value, env, config, _c, _cerr);
};

// TODO: DRY
export const evaluatePropWrap = (
  propertyKey: string,
  body: (c: Continuation, cerr: ErrorContinuation) => void,
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => {
  callInterceptor({ phase: "enter", propertyKey }, config, e, env);

  const _c = value => {
    callInterceptor({ phase: "exit", propertyKey }, config, e, env);
    c(value);
  };
  const _cerr = exception => {
    callInterceptor({ phase: "exit", propertyKey }, config, e, env);
    cerr(exception);
  };
  body(_c, _cerr);
};

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
          switch (exception.type) {
            case "EmptyNode":
              cerr({
                message: `"${e.type}" tried to access non-existing descendant node.). 
                Error occurred in "${e.type}" interpreter.`,
                location: e
              });
              break;
            case "ReturnStatement":
              callInterceptor({ phase: "exit" }, config, e, env, exception.value);
              cerr(exception);
              break;
            default:
              if (!exception.location) {
                exception.location = e;
              }
              cerr(exception);
              break;
          }
        }
      );
    } catch (error) {
      // catch error in interpreters implementations
      throw error;
    }
  } else if (!e) {
    cerr({ type: "EmptyNode" });
  } else {
    const exception = NotImplementedException(`"${e.type}" token interpreter is not defined yet.`, e);
    config.onError && config.onError(exception);
    cerr(exception);
  }
}

// TODO: it's only a sync code. Gradually move to `evaluateArrayAsync`
export function evaluateArrayParametrized(
  array: Iterable<ASTNode>,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation,
  pre?: (i: number) => void
) {
  const results: any[] = [];
  let stopped;
  let i = 0;
  for (let e of array) {
    pre && pre(i++);
    evaluate(
      e,
      env,
      config,
      result => results.push(result),
      e => {
        stopped = e;
        cerr(e);
      }
    );
    if (stopped) {
      return;
    }
  }
  c(results);
}

export const evaluateArray = (
  array: ASTNode[],
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => evaluateArrayParametrized(array, env, config, c, cerr);

type Visitor<T> = (element: T, c: Continuation, cerr: ErrorContinuation) => void;

export function evaluateArrayAsync<T>(items: T[], fn: Visitor<T>, c: Continuation, cerr: ErrorContinuation) {
  const accumulated: T[] = [];

  function loop(array: T[]) {
    if (array.length) {
      fn(
        array[0],
        value => {
          accumulated.push(value);
          // TODO: maybe don't slice and use pointer
          loop(array.slice(1));
        },
        cerr
      );
    } else {
      c(accumulated);
    }
  }

  loop(items);
}

export function apply(e: ASTNode, fn: Function, args: any[], _config: EvaluationConfig, thisObj?: Object) {
  let result;
  try {
    result = fn.apply(thisObj, args);
  } catch (error) {
    if (!error.location) {
      error.location = e;
    }
    throw error;
  }
  return result;
}
