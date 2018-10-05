import { Environment } from "./environment";
import { Continuation, ErrorContinuation, EvaluationConfig } from "./types";

export function callWithCurrentContinuation(
  _receiver: (
    value: any,
    c: Continuation,
    cerr: ErrorContinuation,
    env?: Environment,
    config?: EvaluationConfig
  ) => void,
  _value: any
) {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}
