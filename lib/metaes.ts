import { toEnvironment } from "./environment";
import { evaluate } from "./evaluate";
import { ExportEnvironmentSymbol, ImportEnvironmentSymbol } from "./interpreter/modules";
import { ECMAScriptInterpreters, ModuleECMAScriptInterpreters } from "./interpreters";
import { ExpressionStatement, FunctionNode, Program } from "./nodeTypes";
import { parse, ParseCache } from "./parse";
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  Evaluate,
  EvaluationConfig,
  Phase,
  Script,
  Source
} from "./types";

export interface Context {
  evaluate: Evaluate;
}

let scriptIdsCounter = 0;

export const nextScriptId = () => "" + scriptIdsCounter++;

export function createScript(source: Source, cache?: ParseCache, useModule: boolean = false): Script {
  const scriptId = nextScriptId();

  if (typeof source === "object") {
    return { source, ast: source, scriptId };
  } else if (typeof source === "function") {
    return { source, ast: parseFunction(source, cache), scriptId };
  } else if (typeof source === "string") {
    const script: Script = { source, ast: parse(source, {}, cache, useModule), scriptId };
    if (useModule) {
      script.isModule = useModule;
    }
    return script;
  } else {
    throw new Error(`Can't create script from ${source}.`);
  }
}

export function toScript(input: Source | Script, cache?: ParseCache, useModule: boolean = false) {
  return isScript(input) ? input : createScript(input, cache, useModule);
}

export function isScript(script: any): script is Script {
  return typeof script === "object" && "source" in script && "ast" in script && "scriptId" in script;
}

export function noop() {}

const BaseConfig = { interpreters: ECMAScriptInterpreters, interceptor: noop };

export const safeEvaluate: Evaluate = (
  inject: () => { script: Script; config: EvaluationConfig; env: Environment },
  c?,
  cerr?
) => {
  try {
    let { script, config, env } = inject();
    config = { script, ...config };

    evaluate(
      script.ast,
      val => c && c(val),
      exception => cerr && cerr(exception),
      env,
      config
    );
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
};

export const metaesEval: Evaluate = (input, c?, cerr?, env = {}, config = {}) => {
  safeEvaluate(
    function inject() {
      return { script: toScript(input), config: { ...BaseConfig, ...config }, env: toEnvironment(env) };
    },
    c,
    cerr
  );
};

export const metaesEvalModule: Evaluate = (input, c?, cerr?, env = {}, config = {}) => {
  const _env = toEnvironment(env);
  const importsEnv: Environment = { values: {}, prev: _env, [ImportEnvironmentSymbol]: true };
  const exportsEnv: Environment = { values: {}, prev: importsEnv, [ExportEnvironmentSymbol]: true };
  const bottomEnv: Environment = { values: {}, prev: exportsEnv };

  safeEvaluate(
    function inject() {
      return {
        script: toScript(input, undefined, true),
        config: { ...BaseConfig, ...config, interpreters: ModuleECMAScriptInterpreters },
        env: bottomEnv
      };
    },
    () => c && c(exportsEnv.values),
    cerr
  );
};

export class MetaesContext implements Context {
  constructor(
    public c?: Continuation,
    public cerr?: ErrorContinuation,
    public environment: Environment = { values: {} },
    public defaultConfig: Partial<EvaluationConfig> = {},
    public cache?: ParseCache
  ) {}

  evaluate(
    input: Script | Source,
    c?: Continuation,
    cerr?: ErrorContinuation,
    environment?: Environment | object,
    config?: Partial<EvaluationConfig>
  ) {
    try {
      input = toScript(input, this.cache);

      let env = this.environment;

      if (environment) {
        env = environment.prev ? environment : { prev: this.environment, ...environment };
        // env = { values: "values" in environment ? environment.values : environment, prev: this.environment };
      }
      if (!config) {
        config = { ...this.defaultConfig, script: input };
      }
      if (!config.interceptor) {
        config.interceptor = this.defaultConfig.interceptor || noop;
      }

      metaesEval(input, c || this.c, cerr || this.cerr, env, config);
    } catch (e) {
      if (cerr) {
        cerr(e);
      } else {
        throw e;
      }
    }
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

export const evalAsPromise = (
  context: Context,
  input: Script | Source,
  environment?: Environment,
  config?: Partial<EvaluationConfig>
) => new Promise<any>((resolve, reject) => context.evaluate(input, resolve, reject, environment, config));

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
  config?: Partial<EvaluationConfig>
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
  config?: Partial<EvaluationConfig>
) => new Promise<any>((resolve, reject) => evalFnBody({ context, source }, resolve, reject, environment, config));

export function evalFn<T extends any[]>(
  { context, source, args }: { context: MetaesContext; source: (...T) => void; args?: T },
  c?: Continuation,
  cerr?: ErrorContinuation,
  environment?: Environment,
  config?: Partial<EvaluationConfig>
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
  config?: Partial<EvaluationConfig>
): Promise<any> {
  return new Promise<any>((resolve, reject) => evalFn({ context, source, args }, resolve, reject, environment, config));
}

export const consoleLoggingMetaesContext = (environment: Environment = { values: {} }) =>
  new MetaesContext(console.log, console.error, environment, {
    interceptor(evaluation) {
      console.log(evaluation);
    }
  });

export const callInterceptor = (phase: Phase, config: EvaluationConfig, e: ASTNode, env?: Environment, value?) =>
  config.interceptor !== noop &&
  config.interceptor({
    config,
    e,
    phase,
    value,
    timestamp: Date.now(),
    env
  });
