import { Environment, GetValueSync } from "./environment";
import { NotImplementedException, toException } from "./exceptions";
import { callInterceptor } from "./metaes";
import { ASTNode, Continuation, ErrorContinuation, EvaluationConfig, Interpreter } from "./types";

const _trampoline: any[] = [];
let _trampolinePopping = false;

function trampolinePush(fn) {
  _trampoline.push(fn);
  if (_trampolinePopping) {
    return;
  }
  _trampolinePopping = true;
  trampolinePop();
  _trampolinePopping = false;
}

export function trampolinePop() {
  while (_trampoline.length) {
    try {
      _trampoline.pop()();
    } catch (e) {
      console.log("uncaught, will be rethrown", e);
    }
  }
}

export function evaluate(
  e: ASTNode,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) {
  const interpreter: Interpreter<any> = GetValueSync(e.type, config.interpreters);
  if (interpreter) {
    trampolinePush(function enter() {
      callInterceptor("enter", config, e, env);
      interpreter(
        e,
        value =>
          trampolinePush(function exit() {
            callInterceptor("exit", config, e, env, value);
            c(value);
          }),
        exception =>
          trampolinePush(function exit() {
            exception = toException(exception);
            if (!exception.location) {
              exception.location = e;
            }
            callInterceptor("exit", config, e, env, exception);
            cerr(exception);
          }),
        env,
        config
      );
    });
  } else {
    trampolinePush(function exit() {
      const exception = NotImplementedException(`"${e.type}" node type interpreter is not defined yet.`, e);
      callInterceptor("exit", config, e, env, exception);
      cerr(exception);
    });
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
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) => visitArray(array, (e, c, cerr) => evaluate(e, c, cerr, env, config), c, cerr);