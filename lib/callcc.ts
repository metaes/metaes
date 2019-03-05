import { Environment } from "./environment";
import { createScript, metaesEval } from "./metaes";
import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";

export function callWithCurrentContinuation(
  _receiver: (
    value: any,
    c: Continuation,
    cerr?: ErrorContinuation,
    env?: Environment,
    config?: EvaluationConfig
  ) => any,
  _value?: any
): any {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}

let script;

export function lifted(fn: Function) {
  if (!script) {
    script = createScript(`value => callcc(fn, value)`);
  }
  let result, error;
  metaesEval(script, r => (result = r), e => (error = e), {
    values: { callcc: callWithCurrentContinuation, fn }
  });
  if (error) {
    throw error;
  }
  return result;
}

export function liftedAll(fns: { [k: string]: Function }) {
  const result = {};
  for (let k in fns) {
    result[k] = lifted(fns[k]);
  }
  return result;
}
