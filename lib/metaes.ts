import { parse } from "./parse";
import { ErrorCallback, EvaluationConfig, LocatedError, SuccessCallback } from "./types";
import { evaluate } from "./applyEval";
import { ASTNode } from "./nodes/nodes";
import { FunctionNode, ExpressionStatement } from "./nodeTypes";
import { Environment, EnvironmentBase } from "./environment";

const log = e => console.log(e);

export type Source = string | ASTNode;

// TODO: pass config as well, will be used to add properties while transfering RemoteValues
export interface ScriptingContext {
  evaluate(
    source: Source | Function,
    extraEnvironment?: EnvironmentBase,
    c?: SuccessCallback,
    cerr?: ErrorCallback
  ): any | undefined;
}

export class MetaESContext implements ScriptingContext {
  constructor(
    public environment: Environment = { values: {} },
    public config: EvaluationConfig = { errorCallback: log },
    public c?: SuccessCallback,
    public cerr?: ErrorCallback
  ) {}

  evaluate(
    source: Source | Function,
    extraEnvironment?: EnvironmentBase,
    c?: SuccessCallback,
    cerr?: ErrorCallback
  ): any | undefined {
    let env = this.environment;
    if (extraEnvironment) {
      env = Object.assign({ prev: this.environment }, extraEnvironment);
    }
    return metaESEval(source, env, this.config, c || this.c, cerr || this.cerr);
  }
}

export const evaluatePromisified = (
  context: ScriptingContext,
  source: Source | Function,
  environment?: EnvironmentBase
) =>
  new Promise<any>((resolve, reject) =>
    context.evaluate(source, environment, success => resolve(success.value), error => reject(error.originalError))
  );

const parseFunction = (fn: Function) => parse("(" + fn.toString() + ")");

/**
 * Function params are igonred, they are used only to satisfy linters/compilers on client code.
 * @param context
 * @param source
 * @param environment
 */
export const evaluateFunctionBodyPromisified = (
  context: ScriptingContext,
  source: Function,
  environment?: EnvironmentBase
) => {
  return new Promise<any>((resolve, reject) =>
    context.evaluate(
      ((parseFunction(source).body[0] as ExpressionStatement).expression as FunctionNode).body,
      environment,
      resolve,
      reject
    )
  );
};

export function consoleLoggingMetaESContext(environment: Environment = { values: {} }) {
  return new MetaESContext(
    environment,
    {
      interceptor: evaluation => {
        console.log(evaluation);
      },
      errorCallback: (e: LocatedError) => {
        console.log(e);
      }
    },
    value => {
      console.log(value);
    },
    e => console.log(e)
  );
}

let vmsCounter = 0;

// TODO: don't return anything with return, only use c/cerr
export function metaESEval(
  source: Source | Function,
  environment: Environment | object = {},
  config: EvaluationConfig = { errorCallback: log },
  c?: SuccessCallback,
  cerr?: ErrorCallback
): any | undefined {
  config.name = config.name || "vm" + vmsCounter++;

  try {
    let node: ASTNode =
        typeof source === "object" ? source : typeof source === "function" ? parseFunction(source) : parse(source),
      env: Environment;

    if ("values" in environment) {
      env = environment as Environment;
    } else {
      env = {
        prev: undefined,
        values: environment
      };
    }

    let successValue;
    let errorValue;
    evaluate(
      node,
      env,
      config,
      val => {
        successValue = val;
        if (c) {
          c(val, node);
        }
      },
      error => {
        errorValue = error;
        cerr && cerr(error instanceof LocatedError ? error : new LocatedError(error, node));
      }
    );
    if (errorValue) {
      throw errorValue;
    } else {
      return successValue;
    }
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
}
