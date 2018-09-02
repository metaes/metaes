import { Environment } from "./environment";
import { Continuation } from "./types";

/**
 * Returns current environment.
 */
export function getCurrentEnvironment(): Environment {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}

/**
 * Calls argument giving it current continuation, then stop evaluation (if possible). Continuation is a function
 * that when called it causes evaluation to continue from given point. See unit tests for use examples.
 *
 * @param receiver - A function that when called the evaluation resumes and callWithCurrentContinuation
 *                    will evaluated to whatever was pushed to receiver.
 * @param args - additional values pased to receiver function.
 */
// @ts-ignore - to ignore unused arg warning
export function callWithCurrentContinuation(receiver: (c: Continuation) => void, ...args: any[]): any {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}
