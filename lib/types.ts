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

export type Evaluate<T = any> = (
  input: EvalParam,
  c?: Continuation<T> | null,
  cerr?: ErrorContinuation | null,
  environment?: Environment | object,
  config?: Partial<EvaluationConfig>
) => void;

export type Phase = "enter" | "exit";

export interface Evaluation {
  e: ASTNode;
  value: any;
  phase: Phase;
  config: EvaluationConfig;
  timestamp: number;
  env?: Environment;
}

export type Interceptor = (evaluation: Evaluation) => void;

type Schedule = (task: () => void) => void;

export interface EvaluationConfig {
  interceptor: Interceptor;
  interpreters: Environment<Interpreter<any>>;
  script: Script;
  schedule?: Schedule;
}

export type Continuation<T = any> = (value: T) => void;
export type ErrorContinuation = (error: MetaesException) => void;
export type PartialErrorContinuation = (error: Partial<MetaesException> & { type: MetaesException["type"] }) => void;

export type Interpreter<T extends ASTNode | ASTNode[] | object> = (
  e: T,
  c: (value?: any) => void,
  cerr: PartialErrorContinuation,
  env: Environment,
  config: EvaluationConfig
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
