import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";
import { tokens } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { callInterceptor, Environment } from "./environment";

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
        exception => {
          switch (exception.type) {
            case "EmptyNode":
              cerr({
                value: new Error(
                  `"${e.type}" tried to access non-existing descendant node.). 
          Error occurred in "${e.type}" interpreter.`
                ),
                location: e
              });
              break;
            case "ReturnStatement":
              callInterceptor(e, config, exception.value, env, "exit");
              cerr(exception);
              break;
            default:
              exception.location = e;
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
    const exception = {
      location: e,
      value: new Error(`"${e.type}" token interpreter is not defined yet. Stopped evaluation.`)
    };
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

export function evaluateArrayAsync<T>(
  items: T[],
  fn: (element: T, c: Continuation, cerr: ErrorContinuation) => void,
  c: Continuation,
  cerr: ErrorContinuation
) {
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
    config.onError && config.onError({ location: e, value: error });
    throw error;
  }
  if (typeof result === "object" && result instanceof Promise) {
    // TODO: don't know if it's not going to break other catch'es from regular code?
    result.catch(error => config.onError && config.onError({ location: e, value: error }));
  }
  return result;
}
