import {
  Continuation,
  ErrorContinuation,
  EvaluationConfig,
  LocatedError,
  MetaESError,
  NotImplementedYet
} from "./types";
import { tokens } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { callInterceptor, Environment } from "./environment";

class EmptyNodeError extends Error {}

export class ReturnStatementValue extends Error {
  constructor(public value: any) {
    super();
  }
}

export class ThrowStatementValue extends Error {
  constructor(public value: any) {
    super();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", event => console.log(event));
}

export function evaluate(
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  if (e.type in tokens) {
    callInterceptor(e, config, undefined, env, "enter");
    try {
      tokens[e.type](
        e,
        env,
        config,
        value => {
          callInterceptor(e, config, value, env, "exit");
          c(value);
        },
        error => {
          if (error instanceof EmptyNodeError) {
            cerr(
              new LocatedError(
                e,
                new Error(`"${e.type}" tried to access non-existing descendant node.). 
            Error occurred in "${e.type}" interpreter.`)
              )
            );
          } else if (error instanceof MetaESError) {
            cerr(error);
          } else if (error instanceof ReturnStatementValue) {
            callInterceptor(e, config, error.value, env, "exit");
            cerr(error);
          } else {
            let located = new LocatedError(e, error);
            cerr(located);
          }
        }
      );
    } catch (error) {
      // catch error in interpreters implementations
      throw error;
    }
  } else if (!e) {
    cerr(new EmptyNodeError());
  } else {
    let error = new NotImplementedYet(
      `"${e.type}" token interpreter is not defined yet. Stopped evaluation.`
    );
    config.errorCallback(new LocatedError(e, error));
    cerr(error);
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
  let results: any[] = [];
  let stopped;
  let i = 0;
  for (let e of array) {
    pre && pre(i++);
    evaluate(
      e,
      env,
      config,
      result => {
        results.push(result);
      },
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

export function evaluateArray(
  array: ASTNode[],
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  evaluateArrayParametrized(array, env, config, c, cerr);
}

export function evaluateArrayAsync<T>(
  items: T[],
  fn: (element: T, c: Continuation, cerr: ErrorContinuation) => void,
  c: Continuation,
  cerr: ErrorContinuation
) {
  let accumulated: T[] = [];

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

export function apply(
  e: ASTNode,
  fn: Function,
  args: any[],
  config: EvaluationConfig,
  thisObj?: Object
): Iterable<any> {
  let result;
  try {
    result = fn.apply(thisObj, args);
  } catch (error) {
    config.errorCallback(new LocatedError(e, error));
    throw error;
  }
  if (typeof result === "object" && result instanceof Promise) {
    // TODO: don't know if it's not going to break other catch'es from regular code?
    result.catch(error => {
      config.errorCallback(new LocatedError(e, error));
    });
  }
  return result;
}
