import { toEnvironment } from "./environment";
import { evaluate } from "./evaluate";
import { ExportEnvironmentSymbol, ImportEnvironmentSymbol, modulesEnv } from "./interpreter/modules";
import { ECMAScriptInterpreters, ModuleECMAScriptInterpreters } from "./interpreters";
import { ExpressionStatement, FunctionNode, Program } from "./nodeTypes";
import { parse, ParseCache } from "./parse";
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  EvalParam,
  Evaluate,
  EvaluationConfig,
  PartialErrorContinuation,
  Phase,
  Script,
  ScriptType,
  Source
} from "./types";

export interface Context {
  evaluate: Evaluate;
}

let scriptIdsCounter = 0;

export const nextScriptId = () => "" + scriptIdsCounter++;

function isEvaluable(input: EvalParam): input is Script | Source {
  return (
    typeof input === "string" ||
    typeof input === "function" ||
    isScript(input) ||
    (typeof input === "object" && input && "type" in input)
  );
}

export function createScript(source: Script | Source, cache?: ParseCache, type: ScriptType = "script"): Script {
  if (isScript(source)) {
    return source;
  } else {
    if (typeof source === "object") {
      return { source, ast: source, scriptId: nextScriptId() };
    } else if (typeof source === "function") {
      return { source, ast: parseFunction(source, cache), scriptId: nextScriptId() };
    } else if (typeof source === "string") {
      const script: Script = { source, ast: parse(source, {}, cache, type === "module"), scriptId: nextScriptId() };
      if (type === "module") {
        script.type = type;
      }
      return script;
    } else {
      throw new Error(`Can't create script from ${source}.`);
    }
  }
}

export function toScript(input: Source | Script, cache?: ParseCache, type: ScriptType = "script") {
  return isScript(input) ? input : createScript(input, cache, type);
}

export function isScript(script: any): script is Script {
  return typeof script === "object" && "source" in script && "ast" in script && "scriptId" in script;
}

export function noop() {}

const BaseConfig = { interpreters: ECMAScriptInterpreters, interceptor: noop };

const evaluateConditionally = (
  input: EvalParam,
  inject: (input: Script | Source) => { script: Script; config: Omit<EvaluationConfig, "script">; env: Environment },
  c?,
  cerr?
) => {
  try {
    if (!isEvaluable(input)) {
      c && c(input);
    } else {
      let { script, config, env } = inject(input);

      evaluate(
        script.ast,
        (val) => c && c(val),
        (exception) => cerr && cerr(exception),
        env,
        { ...config, script }
      );
    }
  } catch (e) {
    if (cerr) {
      cerr(e);
    } else {
      throw e;
    }
  }
};

export const metaesEval: Evaluate = (input, c?, cerr?, env = {}, config = {}) =>
  evaluateConditionally(
    input,
    (input) => ({ script: toScript(input), config: { ...BaseConfig, ...config }, env: toEnvironment(env) }),
    c,
    cerr
  );

export const metaesEvalModule: Evaluate = (input, c?, cerr?, env = {}, config = {}) => {
  const importsEnv = { values: modulesEnv, prev: toEnvironment(env), [ImportEnvironmentSymbol]: true };
  const exportsEnv = { prev: importsEnv, values: {}, [ExportEnvironmentSymbol]: true };

  evaluateConditionally(
    input,
    (input) => ({
      script: toScript(input, undefined, "module"),
      config: { ...BaseConfig, interpreters: ModuleECMAScriptInterpreters, ...config },
      env: { values: {}, prev: exportsEnv }
    }),
    () => c && c(exportsEnv.values),
    cerr
  );
};

export class MetaesContext implements Context {
  public environment: Environment;

  constructor(
    public c?: Continuation,
    public cerr?: ErrorContinuation,
    environment?: Environment | object,
    public defaultConfig: Partial<EvaluationConfig> = {},
    public cache?: ParseCache
  ) {
    this.environment = toEnvironment(environment);
  }

  evaluate: Evaluate = (input, c, cerr, env, config) =>
    evaluateConditionally(
      input,
      (input) => {
        const environment = toEnvironment(env);
        return {
          script: createScript(input, this.cache),
          env: "prev" in environment ? environment : { ...environment, prev: this.environment },
          config: { ...BaseConfig, ...this.defaultConfig, ...config }
        };
      },
      c || this.c,
      cerr || this.cerr
    );

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
    (fn) => {
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

/**
 * Converts function from continuation passing style style back to normal return/throw style.
 *
 * It may not work if provided function `fn` doesn't use `c` or `cerr` callbacks immediately.
 */
export const uncps = <I, O, E, C>(
  fn: (input: I, c: Continuation<O>, cerr: PartialErrorContinuation, env?: E, config?: C) => void,
  thisValue?: any
) => (input?: I, env?: E, config?: C): O => {
  let _result, _exception;
  fn.call(
    thisValue,
    input,
    (result) => (_result = result),
    (exception) => (_exception = exception),
    env,
    config
  );
  if (_exception) {
    throw _exception;
  } else {
    return _result;
  }
};

/**
 * Converts function from continuation passing style style back to normal return/throw style using Promise.
 */
export const uncpsp = <I, O, E, C>(
  fn: (input: I, c: Continuation<O>, cerr: PartialErrorContinuation, env?: E, config?: C) => void,
  thisValue?: any
) => (input?: I, env?: E, config?: C) =>
  new Promise<O>((resolve, reject) => fn.call(thisValue, input, resolve, reject, env, config));

const isFn = <T>(value: any): value is (arg: T) => T => typeof value === "function";

export type Upgradable<T> = T | ((arg: T) => T);

export const upgraded = <T>(superArg: T, arg?: Upgradable<T>) => {
  if (isFn(arg)) {
    return arg(superArg);
  } else {
    return superArg;
  }
};

/**
 * Creates function which when called with a function will apply provided arguments.
 */
export const bindArgs = (...args) => (fn) => fn(...args);
