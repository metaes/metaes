import { toEnvironment } from "./environment";
import { defaultScheduler, evaluate } from "./evaluate";
import { ExportEnvironmentSymbol, ImportEnvironmentSymbol, modulesEnv } from "./interpreter/modules";
import { ECMAScriptInterpreters, ModuleECMAScriptInterpreters } from "./interpreters";
import { ExpressionStatement, FunctionNode, Program } from "./nodeTypes";
import { parse, ParseCache } from "./parse";
import { createScript, isScript, nextScriptId, toScript } from "./script";
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  EvalParam,
  Evaluate,
  EvaluateBase,
  EvaluateMid,
  EvaluationConfig,
  PartialErrorContinuation,
  Phase,
  Script,
  Source
} from "./types";

export interface Context {
  evaluate: Evaluate;
}

export const BaseConfig = { interpreters: ECMAScriptInterpreters, schedule: defaultScheduler };
export const BaseModuleConfig = { ...BaseConfig, interpreters: ModuleECMAScriptInterpreters };

export function isEvaluable(input: EvalParam): input is Script | Source {
  return (
    typeof input === "string" ||
    typeof input === "function" ||
    isScript(input) ||
    (typeof input === "object" && input && "type" in input)
  );
}

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

export const metaesEval: EvaluateBase = (input, c, cerr, env = {}, config = {}) =>
  evaluateConditionally(
    input,
    (input) => ({ script: toScript(input), config: { ...BaseConfig, ...config }, env: toEnvironment(env) }),
    c,
    cerr
  );

export const metaesEvalModule: EvaluateBase<{ [key: string]: any }> = (input, c, cerr, env = {}, config = {}) => {
  const importsEnv = { values: modulesEnv, prev: toEnvironment(env), [ImportEnvironmentSymbol]: true };
  const exportsEnv = { prev: importsEnv, values: {}, [ExportEnvironmentSymbol]: true };

  evaluateConditionally(
    input,
    (input) => ({
      script: toScript(input, undefined, "module"),
      config: { ...BaseModuleConfig, ...config },
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

  evaluate: EvaluateBase = (input, c, cerr, env, config) =>
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
}

export const parseFunction = (fn: Function, cache?: ParseCache) =>
  parse("(" + fn.toString() + ")", { loc: false, range: false }, cache);

export const createScriptFromFnBody = (source: Function, cache?: ParseCache) => ({
  ast: (((parseFunction(source, cache) as Program).body[0] as ExpressionStatement).expression as FunctionNode)
    .body as ASTNode,
  scriptId: nextScriptId(),
  source
});

export const evalFn =
  <T extends any[]>(evaluate: EvaluateMid): EvaluateMid<any, { source: (...T) => void; args?: T }> =>
  ({ source, args }, c, cerr, environment, config) =>
    evaluate(
      source,
      (fn) => {
        try {
          c(fn.apply(null, args));
        } catch (e) {
          cerr(e);
        }
      },
      cerr,
      environment,
      config
    );

export const evalFnBody =
  (evaluate: EvaluateBase): EvaluateBase<any, Function> =>
  (source, c, cerr, env, config) =>
    evaluate(createScriptFromFnBody(source), c, cerr, env, config);

export const consoleLoggingMetaesContext = (environment: Environment = { values: {} }) =>
  new MetaesContext(console.log, console.error, environment, {
    interceptor(evaluation) {
      console.log(evaluation);
    }
  });

export const callInterceptor = (phase: Phase, config: EvaluationConfig, e: ASTNode, env: Environment, value?) =>
  config.interceptor &&
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
 * It may not work if provided function `fn` doesn't use `c` or `cerr` callbacks immediately. Use `uncpsp` in this case.
 */
export const uncps =
  <I, O, R extends any[]>(
    fn: (input: I, c: Continuation<O>, cerr: PartialErrorContinuation, ...rest: R) => void,
    thisValue?: any
  ) =>
  (input?: I, ...rest: R): O => {
    let _result, _exception;
    fn.call(
      thisValue,
      input,
      (result) => (_result = result),
      (exception) => (_exception = exception),
      ...rest
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
export const uncpsp =
  <I, O, R extends any[]>(
    fn: (input: I, c: Continuation<O>, cerr: PartialErrorContinuation, ...rest: R) => void,
    thisValue?: any
  ) =>
  (input?: I, ...rest: R) =>
    new Promise<O>((resolve, reject) => fn.call(thisValue, input, resolve, reject, ...rest));

export const cpsify =
  <I, O>(fn: (input: I, env?: Environment, config?: Partial<EvaluationConfig>) => O): EvaluateMid<O, I> =>
  (i, c, cerr, env, config) => {
    try {
      c(fn(i, toEnvironment(env), config));
    } catch (e) {
      cerr(e);
    }
  };

const isFn = <T>(value: any): value is (arg: T) => T => typeof value === "function";

export type Upgradable<T> = T | ((arg: T) => T);

export const upgraded = <T>(superArg: T, update?: Upgradable<Partial<T>>) => ({
  ...superArg,
  ...(isFn(update) ? update(superArg) : update)
});

/**
 * Creates list of arguments waiting to be applied to a function.
 */
export const bindArgs =
  <T extends any[]>(...args: T) =>
  (fn: (...args: T) => unknown) =>
    fn(...args);
