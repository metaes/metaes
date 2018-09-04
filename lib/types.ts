import { ASTNode } from "./nodes/nodes";
import { Environment, Reference } from "./environment";
import { FunctionNode } from "./nodeTypes";

export type MetaesException = {
  type?: "Error" | "ReturnStatement" | "NotImplemented" | "ThrowStatement" | "ReferenceError";
  message?: string;
  value?: Error | any;
  location?: ASTNode;
};

export type Range = [number, number];

export type ParsedSource = { raw: string; ast: ASTNode };

export type Source = string | ASTNode | ParsedSource;

export type Evaluate = (
  source: Source | Function,
  c?: Continuation | null,
  cerr?: ErrorContinuation | null,
  environment?: Environment | object,
  config?: Partial<EvaluationConfig>
) => void;

/**
 * enter - before ASTNode was evaluated
 * exit - after ASTNode was evaluated
 */
export type EvaluationTag = { phase: "enter" | "exit"; propertyKey?: string };

export type EvaluationValue = any | Reference;

export interface Evaluation {
  scriptId: string;
  e: ASTNode;
  value: EvaluationValue;
  tag: EvaluationTag;
  timestamp: number;
  env?: Environment;
}

export type Interceptor = (evaluation: Evaluation) => void;

export interface EvaluationConfig {
  interceptor: Interceptor;
  scriptId: string;
}

export type Continuation = (value?: MetaesException | any) => void;
export type ErrorContinuation = (error: MetaesException) => void;

type Interpreter<T extends ASTNode> = (
  e: T,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) => void;

export type interpretersMap = {
  [key: string]: Interpreter<any>;
};

export type MetaesFunction = {
  e: FunctionNode;
  closure: Environment;
  config: EvaluationConfig;
};
