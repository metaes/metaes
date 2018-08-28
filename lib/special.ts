import { Environment } from "./environment";

/**
 * Should be called only inside Metaes context,
 * CallExpression interpreter makes sure it returns current environment.
 */
export function getCurrentEnvironment(): Environment {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}

/**
 * Should be called only inside Metaes context,
 * CallExpression interpreter makes sure it returns current environment.
 */
export function callCC(..._: any[]): any {
  throw new Error("Not intended to be called directly, call from Metaes context.");
}
