import { metaesEval, uncps } from "./metaes";
import { createScript } from "./script";
import { Continuation, Environment, ErrorContinuation, EvaluationConfig } from "./types";

/**
 * callcc passes control from interpreter core to another function named here `_receiver`.
 * _receiver is in charge to resume evaluation usinc passed `c` and `cerr` continuations.
 * _receiver is any valid JavaScript function.
 *
 * callcc is never called as a function, it's a special value recognized by intereter to bypass normal flow.
 *
 * @param _receiver
 * @param _value
 */
export function callcc<T, U>(
  _receiver: (
    value: T | undefined,
    c: Continuation<U>,
    cerr?: ErrorContinuation,
    env?: Environment,
    config?: EvaluationConfig
  ) => void,
  _value?: T
): U {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}

let script;

export function lifted(fn: Function) {
  if (!script) {
    script = createScript(
      // @ts-ignore
      (...args) => callcc(fn, args)
    );
  }

  return uncps(metaesEval)(script, {
    values: { callcc, fn }
  });
}

export function liftedAll(fns: { [k: string]: Function }) {
  const result = {};
  for (let k in fns) {
    result[k] = lifted(fns[k]);
  }
  return result;
}
