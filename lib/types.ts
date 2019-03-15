import { Environment, Reference } from "./environment";
import { FunctionNode } from "./nodeTypes";

export type MetaesException = {
  // TODO: ThrowStatement not needed?
  type?: "Error" | "ReturnStatement" | "NotImplemented" | "ThrowStatement" | "ReferenceError";
  message?: string;
  value?: Error | any;
  location?: ASTNode;
};

export type Range = [number, number];

export type Script = {
  ast: ASTNode;
  source: Source;
  scriptId: string;
};

export type Source = string | ASTNode | Function;

export type Evaluate = (
  input: Script | Source,
  c?: Continuation | null,
  cerr?: ErrorContinuation | null,
  environment?: Environment | object,
  config?: Partial<EvaluationConfig>
) => void;

export type EvaluationValue = any | Reference;

export type Phase = "enter" | "exit";

export interface Evaluation {
  e: ASTNode;
  value: EvaluationValue;
  phase: Phase;
  config: EvaluationConfig;
  timestamp: number;
  env?: Environment;
}

export type Interceptor = (evaluation: Evaluation) => void;

export interface EvaluationConfig {
  interceptor: Interceptor;
  interpreters: Environment;
  script: Script;
}

export type Continuation<T = any> = (value?: T) => void;
export type ErrorContinuation = (error: MetaesException) => void;

export type Interpreter<T extends ASTNode> = (
  e: T,
  c: Continuation,
  cerr: ErrorContinuation,
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
};

export interface NodeLoc {
  start: { column: number; line: number };
  end: { column: number; line: number };
}

export interface NodeBase {
  loc?: NodeLoc;
  range?: [number, number];
}

export type ASTNode = NodeBase & {
  type: any;

  // Any other node specific props are allowed
  [key: string]: any;
};