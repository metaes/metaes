import { Upgradable } from "./metaes";
import { FunctionNode } from "./nodeTypes";

export type MetaesException = {
  type: "Error" | "ReturnStatement" | "BreakStatement" | "ContinueStatement";
  message: string;
  location: ASTNode;
  script: Script;
  value?: Error | any | MetaesException;
};

export type Range = [number, number];

export type ScriptType = "script" | "module";

export type Script = {
  ast: ASTNode;
  source: Source;
  scriptId: string;
  url?: string;
  type?: ScriptType;
};

export type NonEvaluableValue = undefined | boolean | number | boolean | symbol | any[] | object;
export type Source = string | ASTNode | Function;
export type EvalParam = Script | Source | NonEvaluableValue;

type Continuations<C = any, E = ErrorContinuation> = [Continuation<C>, E];
type Rest<U = false, C = Partial<EvaluationConfig>> = [
  Environment | EnvironmentBase | object,
  U extends true ? Upgradable<C> : C
];
type Builder<I, C extends any[], R extends any[]> = [I, ...C, ...R];

/**
 * All params are required.
 */
export type Evaluate<C = any, I = EvalParam> = (
  ...args: Builder<I, Continuations<C>, [Environment, EvaluationConfig]>
) => void;

/**
 * Only input is required.
 */
export type EvaluateBase<C = any, I = EvalParam, U = false> = (
  ...args: Builder<I, Partial<Continuations<C>>, Partial<Rest<U>>>
) => void;

/**
 * Environment and config are optional.
 */
export type EvaluateMid<C = any, I = EvalParam, U = false> = (
  ...args: Builder<I, Continuations<C>, Partial<Rest<U>>>
) => void;

/**
 * Used in client code, config param accepts upgrade function.
 */
export type EvaluateClient<C = any, I = EvalParam, U = false> = (
  ...args: Builder<I, Continuations<C>, Partial<Rest<U>>>
) => void;
export type Phase = "enter" | "exit";

export interface Evaluation {
  e: ASTNode;
  value: any;
  phase: Phase;
  config: EvaluationConfig;
  timestamp: number;
  env: Environment;
}

export type Interceptor = (evaluation: Evaluation) => void;

type Schedule = (task: () => void) => void;

export interface EvaluationConfig {
  interceptor?: Interceptor;
  interpreters: Environment<Interpreter<any>>;
  script: Script;
  schedule: Schedule;
}

export type Optional<T> = { boxed: T };
export type Continuation<T = any> = T extends undefined
  ? () => void
  : T extends Optional<infer I>
  ? (value?: I) => void
  : (value: T) => void;

export type ErrorContinuation = (error: MetaesException) => void;
export type PartialErrorContinuation = (error: Pick<MetaesException, "type"> & Partial<MetaesException>) => void;

export type Interpreter<T extends ASTNode | ASTNode[] | object> = (
  ...args: Builder<T, [(value?: any) => void, PartialErrorContinuation], [Environment, EvaluationConfig]>
) => void;

export type Interpreters = {
  [key: string]: Interpreter<any>;
};

export type MetaesFunction = {
  e: FunctionNode;
  closure: Environment;
  config: EvaluationConfig;
  prev?: MetaesFunction;
};

export interface NodeLoc {
  start: { column: number; line: number };
  end: { column: number; line: number };
}

type Position = {
  loc?: NodeLoc;
  range?: [number, number];
};

export type NodeBase = Position;

export type ASTNode = NodeBase & {
  type: string | any;

  // Any other node specific props are allowed
  [key: string]: any;
};

export interface EnvironmentBase<T = any> {
  values: { [key: string]: T };
}

export interface Environment<T = any> extends EnvironmentBase<T> {
  prev?: Environment<T>;

  /**
   * If true, then user code won't save values in this environment.
   */
  internal?: boolean;
  [key: string]: any; // allow extensions
}
