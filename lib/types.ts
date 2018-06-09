import { ASTNode } from "./nodes/nodes";
import { Environment, Reference } from "./environment";
import { FunctionNode } from "./nodeTypes";

export type MetaesException = {
  type?: "Error" | "ReturnStatement" | "EmptyNode" | "NotImplemented" | "ThrowStatement" | "ReferenceError";
  message?: string;
  value?: Error | any;
  location?: ASTNode;
};

export type Range = [number, number];

export type OnSuccess = (value: any, node?: ASTNode) => void;
export type OnError = (e: MetaesException) => void;

/**
 * enter - before ASTNode was evaluated
 * exit - after ASTNode was evaluated
 */
export type EvaluationTag = { phase: "enter" | "exit"; propertyKey?: string };

export interface Evaluation {
  tag: EvaluationTag;
  e: ASTNode;
  value: EvaluationValue;
  env: Environment;
  timestamp: number;
  scriptId: string;
}

export type EvaluationValue = any | Reference;

export type Source = string | ASTNode;

export type Evaluate = (
  source: Source | Function,
  c?: OnSuccess | null,
  cerr?: OnError | null,
  environment?: Environment | object,
  config?: Partial<EvaluationConfig>
) => void;

export type Interceptor = (
  tag: EvaluationTag,
  e: ASTNode,
  value: EvaluationValue,
  env: Environment,
  timestamp: number,
  scriptId: string
) => void;

// TODO: will be used to add properties while transfering RemoteValues
export interface EvaluationConfig {
  interceptor: Interceptor;

  // Per context unique id of running script.
  scriptId?: string;

  // if true, the interceptor will receive Reference object for Identifiers, not a bare JavaScript values.
  // It's following ECMAScript reference naming guidelines
  // TODO: it's not tested/not used anywhere yet. Remains here for historical reasons, should be cleaned up.
  useReferences?: boolean;

  // Inform about asychronous errors
  onError?: OnError;
}

export type Continuation = (value: MetaesException | any) => void;
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
  config?: EvaluationConfig;
};
