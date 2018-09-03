import { parse } from "./parse";
import { Continuation, ErrorContinuation, Evaluate, EvaluationConfig, EvaluationTag, Source } from "./types";
import { evaluate } from "./applyEval";
import { ASTNode } from "./nodes/nodes";
import { ExpressionStatement, FunctionNode } from "./nodeTypes";
import { Environment, toEnvironment } from "./environment";

export interface Context {
  evaluate: Evaluate;
}

let scriptIdsCounter = 0;

export const metaesEval: Evaluate = (source, c?, cerr?, environment = {}, config = {}) => {
  if (!config.interceptor) {
    config.interceptor = function noop() {};
  }
  if (!config.scriptId) {
    config.scriptId = "" + scriptIdsCounter++;
  }
  try {
    evaluate(
      typeof source === "object" ? source : typeof source === "function" ? parseFunction(source) : parse(source),
      toEnvironment(environment),
      config as EvaluationConfig,
      val => c && c(val),
      exception => cerr && cerr(exception)
    );
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
};

export class MetaesContext implements Context {
  constructor(
    public c?: Continuation,
    public cerr?: ErrorContinuation,
    public environment: Environment = { values: {} },
    public config: Partial<EvaluationConfig> = {}
  ) {}

  /**
   * Runs metaesEval configured by provided parameters.
   * @param source
   * @param c
   * @param cerr
   * @param environment - If user provides environment with `prev` field it means he wants to completely replace current evaluation environment.
   *                      If `prev` is not defined, new environment will be build using provided values and refering to context's original environment with `prev`.
   * @param config
   */
  evaluate(
    source: Source | Function,
    c?: Continuation,
    cerr?: ErrorContinuation,
    environment?: Environment,
    config?: Partial<EvaluationConfig>
  ) {
    let env = this.environment;

    if (environment) {
      env = environment.prev ? environment : Object.assign({ prev: this.environment }, environment);
    }
    metaesEval(source, c || this.c, cerr || this.cerr, env, config || this.config);
  }
}

export const evalToPromise = (context: Context, source: Source | Function, environment?: Environment) =>
  new Promise<any>((resolve, reject) => context.evaluate(source, resolve, reject, environment));

export const parseFunction = (fn: Function) => parse("(" + fn.toString() + ")", { loc: false, range: false });

/**
 * Function params are igonred, they are used only to satisfy linters/compilers on client code.
 * @param context
 * @param source
 * @param environment
 */
export const evalFunctionBody = (context: Context, source: Function, environment?: Environment) =>
  new Promise((resolve, reject) =>
    context.evaluate(
      ((parseFunction(source).body[0] as ExpressionStatement).expression as FunctionNode).body,
      resolve,
      reject,
      environment
    )
  );

/**
 * Evaluates function in context.
 * @param source
 * @param args
 */
export async function evaluateFunction(context: MetaesContext, source: ((...rest) => void), ...args: any[]) {
  return (await evalToPromise(context, source)).apply(null, args);
}

export const consoleLoggingMetaesContext = (environment: Environment = { values: {} }) =>
  new MetaesContext(
    value => {
      console.log(value);
    },
    e => console.log(e),
    environment,
    {
      interceptor: evaluation => {
        console.log(evaluation);
      }
    }
  );

export const callInterceptor = (tag: EvaluationTag, config: EvaluationConfig, e: ASTNode, env?: Environment, value?) =>
  config.interceptor({
    scriptId: config.scriptId,
    e,
    tag,
    value,
    timestamp: new Date().getTime(),
    env
  });
