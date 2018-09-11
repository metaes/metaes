import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";
import { tokens } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { Environment } from "./environment";
import { NotImplementedException } from "./exceptions";
import { callInterceptor } from "./metaes";

export function evaluate(
  e: ASTNode,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  if (e.type in tokens) {
    callInterceptor("enter", config, e, env);
    try {
      tokens[e.type](
        e,
        env,
        config,
        value => {
          callInterceptor("exit", config, e, env, value);
          c(value);
        },
        exception => {
          if (!exception.location) {
            exception.location = e;
          }
          callInterceptor("exit", config, e, env, exception);
          cerr(exception);
        }
      );
    } catch (error) {
      throw error;
    }
  } else {
    const exception = NotImplementedException(`"${e.type}" node type interpreter is not defined yet.`, e);
    callInterceptor("enter", config, e, env);
    cerr(exception);
    callInterceptor("enter", config, e, env, exception);
  }
}

type Visitor<T> = (element: T, c: Continuation, cerr: ErrorContinuation) => void;

/**
 * visitArray uses trampolining inside as it's likely that too long array execution will eat up callstack.
 * @param items
 * @param fn
 * @param c
 * @param cerr
 */
export const visitArray = <T>(items: T[], fn: Visitor<T>, c: Continuation, cerr: ErrorContinuation) => {
  if (items.length === 0) {
    c([]);
  } else if (items.length === 1) {
    fn(items[0], value => c([value]), cerr);
  } else {
    // Array of loop function arguments to be applied next time
    // TODO: convert to nextOperation or similar, there is always only one? What about callCC
    const tasks: any[] = [];
    // Indicates if tasks execution is done. Initially it is done.
    let done = true;

    // Simple `loop` function executor, just loop over arguments until nothing is left.
    function execute() {
      done = false;
      while (tasks.length) {
        (<any>loop)(...tasks.shift());
      }
      done = true;
    }

    const visited = new Set();

    function loop(index, accumulated: T[]) {
      if (index < items.length) {
        fn(
          items[index],
          value => {
            // If true, it means currently may be happening for example a reevaluation of items
            // from certain index using call/cc. Copy accumulated previously results and ignore their tail
            // after given index as this reevalution may happen in the middle of an array.
            if (visited.has(index)) {
              accumulated = accumulated.slice(0, index);
            }
            accumulated.push(value);
            visited.add(index);
            tasks.push([index + 1, accumulated]);
            if (done) {
              execute();
            }
          },
          cerr
        );
      } else {
        c(accumulated);
      }
    }

    // start
    loop(0, []);
  }
};

export const evaluateArray = (
  array: ASTNode[],
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => visitArray(array, (e, c, cerr) => evaluate(e, env, config, c, cerr), c, cerr);

export const apply = (fn: Function, thisObj: any, args: any[]) => fn.apply(thisObj, args);
