import { parse } from "./parse";
import { Continuation, ErrorContinuation, Evaluate, EvaluationConfig, EvaluationTag, Source, Script } from "./types";
import { evaluate } from "./applyEval";
import { ASTNode } from "./nodes/nodes";
import { ExpressionStatement, FunctionNode, Program } from "./nodeTypes";
import { Environment, toEnvironment } from "./environment";

export interface Context {
  evaluate: Evaluate;
}

let scriptIdsCounter = 0;

export const nextScriptId = () => "" + scriptIdsCounter++;

export function createScript(source: Source): Script {
  const scriptId = nextScriptId();

  if (typeof source === "object") {
    return { source, ast: source, scriptId };
  } else if (typeof source === "function") {
    return { source, ast: parseFunction(source), scriptId };
  } else if (typeof source === "string") {
    return { source, ast: parse(source), scriptId };
  } else {
    throw new Error(`Can't create script from ${source}.`);
  }
}

export function toScript(input: Source | Script) {
  return isScript(input) ? input : createScript(input);
}

export function isScript(script: any): script is Script {
  return typeof script === "object" && "source" in script && "ast" in script && "scriptId" in script;
}

export const metaesEval: Evaluate = (script, c?, cerr?, environment = {}, config = {}) => {
  script = toScript(script);
  config.script = script;
  config.interceptor = config.interceptor || function noop() {};

  try {
    evaluate(
      script.ast,
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
    public defaultConfig: Partial<EvaluationConfig> = {}
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
    input: Script | Source,
    c?: Continuation,
    cerr?: ErrorContinuation,
    environment?: Environment,
    config?: Partial<EvaluationConfig>
  ) {
    input = toScript(input);
    
    let env = this.environment;

    if (environment) {
      env = environment.prev ? environment : Object.assign({ prev: this.environment }, environment);
    }
    if (!config) {
      config = { script: input };
    }
    if (!config.interceptor) {
      config.interceptor = this.defaultConfig.interceptor;
    }
    metaesEval(input, c || this.c, cerr || this.cerr, env, config);
  }
}

export const evalToPromise = (context: Context, input: Script | Source, environment?: Environment) =>
  new Promise<any>((resolve, reject) => context.evaluate(toScript(input), resolve, reject, environment));

export const parseFunction = (fn: Function) => parse("(" + fn.toString() + ")", { loc: false, range: false });

/**
 * Function params are igonred, they are used only to satisfy linters/compilers on client code.
 * @param context
 * @param source
 * @param environment
 */
export const evalFunctionBody = (context: Context, source: Function, environment?: Environment) => {
  const script = {
    ast: (((parseFunction(source) as Program).body[0] as ExpressionStatement).expression as FunctionNode).body,
    scriptId: nextScriptId(),
    source
  };
  return new Promise((resolve, reject) => context.evaluate(script, resolve, reject, environment));
};

/**
 * Evaluates function in context.
 * TODO: creates new script each time - optimize.
 * @param source
 * @param args
 */
export async function evaluateFunction(context: MetaesContext, source: ((...rest) => void), ...args: any[]) {
  return (await evalToPromise(context, createScript(source))).apply(null, args);
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
    script: config.script,
    e,
    tag,
    value,
    timestamp: new Date().getTime(),
    env
  });
