import { GetValueSync } from "./environment";
import { NotImplementedException, toException } from "./exceptions";
import { callInterceptor } from "./metaes";
import { CallExpression, EvalNode, TaggedTemplateExpression } from "./nodeTypes";
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  EvaluationConfig,
  MetaesException,
  PartialErrorContinuation
} from "./types";

export const posAt = ({ loc, range }: ASTNode) => ({ loc, range });
export const at = <T>({ loc, range }: ASTNode, rest: T) => <const>{ loc, range, ...rest };
export const declare = (name: string, value: any) => <const>{ type: "SetValue", name, value, isDeclaration: true };
export const get = (name: string) => <const>{ type: "GetValue", name };
export const set = (name: string, value: any) => <const>{ type: "SetValue", name, value, isDeclaration: false };
export const apply = (
  fn: Function,
  thisValue: any | undefined,
  args: any[] = [],
  e: CallExpression | TaggedTemplateExpression
) =>
  <const>{
    type: "Apply",
    fn,
    thisValue,
    args,
    e
  };
export const getProperty = (object: any, property: any) => <const>{ type: "GetProperty", object, property };
export const setProperty = (object: any, property: any, value: any, operator: string) =>
  <const>{
    type: "SetProperty",
    object,
    property,
    value,
    operator
  };

export function defaultScheduler(fn) {
  fn();
}

export function getTrampolineScheduler() {
  const tasks: Function[] = [];
  let running = false;

  function run() {
    if (running) {
      return;
    }
    running = true;
    while (tasks.length) {
      tasks.pop()!();
    }
    running = false;
  }

  return function (fn) {
    tasks.push(fn);
    if (!running) {
      run();
    }
  };
}

export function evaluate(
  e: EvalNode,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) {
  const interpreter = GetValueSync(e.type, config.interpreters);
  const schedule = config.schedule || defaultScheduler;
  if (interpreter) {
    callInterceptor("enter", config, e, env);
    schedule(function run() {
      interpreter(
        e,
        function _c(value) {
          schedule(function exit() {
            callInterceptor("exit", config, e, env, value);
            c(value);
          });
        },
        function _cerr(exception) {
          exception = toException(exception);
          if (!exception.location) {
            exception.location = e;
          }
          if (!exception.script) {
            exception.script = config.script;
          }
          callInterceptor("exit", config, e, env, exception);
          cerr(<MetaesException>exception);
        },
        env,
        config
      );
    });
  } else {
    const exception = NotImplementedException(`"${e.type}" node type interpreter is not defined yet.`, e);
    callInterceptor("exit", config, e, env, exception);
    cerr(<MetaesException>exception);
  }
}

type Visitor<T> = (element: T, c: Continuation, cerr: PartialErrorContinuation) => void;

export const visitArray = <T>(items: T[], fn: Visitor<T>, c: Continuation, cerr: PartialErrorContinuation) => {
  if (items.length === 0) {
    c([]);
  } else if (items.length === 1) {
    fn(items[0], (value) => c([value]), cerr);
  } else {
    const schedule = getTrampolineScheduler();
    const visited = new Set();

    function loop(index, accumulated: T[]) {
      if (index < items.length) {
        fn(
          items[index],
          function onNextItem(value) {
            // If true, it means currently may be happening for example a reevaluation of items
            // from certain index using call/cc. Copy accumulated previously results and ignore their tail
            // after given index as this reevalution may happen in the middle of an array.
            if (visited.has(index)) {
              accumulated = accumulated.slice(0, index);
            }
            accumulated.push(value);
            visited.add(index);
            schedule(() => loop(index + 1, accumulated));
          },
          cerr
        );
      } else {
        c(accumulated);
      }
    }

    // start
    schedule(() => loop(0, []));
  }
};

export const evaluateArray = (
  array: ASTNode[],
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) => visitArray(array, (e, c, cerr) => evaluate(e, c, cerr, env, config), c, cerr);
