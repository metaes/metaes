import { evaluate } from "./evaluate";
import { Environment, toEnvironment } from "./environment";
import { ECMAScriptInterpreters } from "./interpreters";
import { ASTNode } from "./nodes/nodes";
import { ExpressionStatement, FunctionNode, Program } from "./nodeTypes";
import { parse, ParseCache } from "./parse";
import { Continuation, ErrorContinuation, Evaluate, EvaluationConfig, Phase, Script, Source } from "./types";

export interface Context {
  evaluate: Evaluate;
}

let scriptIdsCounter = 0;

export const nextScriptId = () => "" + scriptIdsCounter++;

export function createScript(source: Source, cache?: ParseCache): Script {
  const scriptId = nextScriptId();

  if (typeof source === "object") {
    return { source, ast: source, scriptId };
  } else if (typeof source === "function") {
    return { source, ast: parseFunction(source, cache), scriptId };
  } else if (typeof source === "string") {
    return { source, ast: parse(source, {}, cache), scriptId };
  } else {
    throw new Error(`Can't create script from ${source}.`);
  }
}

export function toScript(input: Source | Script, cache?: ParseCache) {
  return isScript(input) ? input : createScript(input, cache);
}

export function isScript(script: any): script is Script {
  return typeof script === "object" && "source" in script && "ast" in script && "scriptId" in script;
}

export function noop() {}

const BaseConfig = { interpreters: ECMAScriptInterpreters, interceptor: noop };

export const metaesEval: Evaluate = (script, c?, cerr?, environment = {}, config = {}) => {
  script = toScript(script);
  config = Object.assign({ script }, BaseConfig, config);

  try {
    evaluate(
      script.ast,
      val => c && c(val),
      exception => cerr && cerr(exception),
      toEnvironment(environment),
      config as EvaluationConfig
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
    public defaultConfig: Partial<EvaluationConfig> = {},
    public cache?: ParseCache
  ) {}

  /**
   * Runs metaesEval configured by provided parameters.
   * @param source
   * @param c
   * @param cerr
   * @param environment - If user provides environment with `prev` field it means he wants to completely replace current evaluation environment.
   *                      If `prev` is not defined, new environment will be built using provided values and refering to context's original environment with `prev`.
   * @param config
   */
  evaluate(
    input: Script | Source,
    c?: Continuation,
    cerr?: ErrorContinuation,
    environment?: Environment,
    config?: Partial<EvaluationConfig>
  ) {
    input = toScript(input, this.cache);

    let env = this.environment;

    if (environment) {
      env = environment.prev ? environment : Object.assign({ prev: this.environment }, environment);
    }
    if (!config) {
      config = Object.assign({}, this.defaultConfig, { script: input });
    }
    if (!config.interceptor) {
      config.interceptor = this.defaultConfig.interceptor || noop;
    }

    metaesEval(input, c || this.c, cerr || this.cerr, env, config);
  }

  evalAsPromise(input: Script | Source, environment?: Environment) {
    return evalAsPromise(this, input, environment);
  }

  evalFnBody(
    source: Function,
    c?: Continuation,
    cerr?: ErrorContinuation,
    environment?: Environment,
    config?: EvaluationConfig
  ) {
    evalFnBody({ context: this, source }, c, cerr, environment, config);
  }

  evalFn(source: (...rest) => void, ...args: any[]) {
    return evalFn({ context: this, source, args });
  }
}

export const parseFunction = (fn: Function, cache?: ParseCache) =>
  parse("(" + fn.toString() + ")", { loc: false, range: false }, cache);

export const evalAsPromise = (context: Context, input: Script | Source, environment?: Environment) =>
  new Promise((resolve, reject) => context.evaluate(input, resolve, reject, environment));

export const createScriptFromFnBody = (source: Function, cache?: ParseCache) => ({
  ast: (((parseFunction(source, cache) as Program).body[0] as ExpressionStatement).expression as FunctionNode)
    .body as ASTNode,
  scriptId: nextScriptId(),
  source
});

export const evalFnBody = (
  { context, source }: { context: Context; source: Function },
  c?: Continuation,
  cerr?: ErrorContinuation,
  environment?: Environment,
  config?: EvaluationConfig
) =>
  context.evaluate(
    createScriptFromFnBody(source, context instanceof MetaesContext ? context.cache : void 0),
    c,
    cerr,
    environment,
    config
  );

export const evalFnBodyAsPromise = (
  { context, source }: { context: Context; source: Function },
  environment?: Environment,
  config?: EvaluationConfig
) => new Promise<any>((resolve, reject) => evalFnBody({ context, source }, resolve, reject, environment, config));

export function evalFn<T extends any[]>(
  { context, source, args }: { context: MetaesContext; source: (...T) => void; args?: T },
  c?: Continuation,
  cerr?: ErrorContinuation,
  environment?: Environment,
  config?: EvaluationConfig
) {
  context.evaluate(
    source,
    fn => {
      try {
        const result = fn.apply(null, args);
        if (c) {
          c(result);
        }
      } catch (e) {
        if (cerr) {
          cerr(e);
        } else {
          throw e;
        }
      }
    },
    cerr,
    environment,
    config
  );
}

export function evalFnAsPromise<T extends any[]>(
  { context, source, args }: { context: MetaesContext; source: (...T) => void; args?: T },
  environment?: Environment,
  config?: EvaluationConfig
): Promise<any> {
  return new Promise((resolve, reject) => evalFn({ context, source, args }, resolve, reject, environment, config));
}

export const consoleLoggingMetaesContext = (environment: Environment = { values: {} }) =>
  new MetaesContext(console.log, console.error, environment, {
    interceptor(evaluation) {
      console.log(evaluation);
    }
  });

const hasPerformance = typeof performance === "function";

export const callInterceptor = (phase: Phase, config: EvaluationConfig, e: ASTNode, env?: Environment, value?) =>
  config.interceptor !== noop &&
  config.interceptor({
    config,
    e,
    phase,
    value,
    timestamp: hasPerformance ? performance.now() : new Date().getTime(),
    env
  });
