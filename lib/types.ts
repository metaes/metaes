import { ASTNode } from "./nodes/nodes";
import { Environment, Reference } from "./environment";
import { FunctionNode } from "./nodeTypes";

export type MetaesException = {
  type?: "Error" | "ReturnStatement" | "EmptyNode" | "NotImplemented";
  message?: string;
  value?: Error | any;
  location?: ASTNode;
};

export const NotImplementedException = (message: string): MetaesException => ({ type: "NotImplemented", message });
export const LocatedException = (value: any, location: ASTNode): MetaesException => ({ value, location });

export type Range = [number, number];

export type OnSuccess = (value: any, node?: ASTNode) => void;
export type OnError = (e: MetaesException) => void;

/**
 * enter - before ASTNode was evaluated
 * exit - after ASTNode was evaluated
 */
export type EvaluationType = "enter" | "exit";

export type EvaluationValue = any | Reference;

export interface Evaluation {
  e: ASTNode;
  value: EvaluationValue;
  env: Environment;
  type: EvaluationType;
  timestamp: number;
}

export type Source = string | ASTNode;

export type Evaluate = (
  source: Source | Function,
  c?: OnSuccess | null,
  cerr?: OnError | null,
  environment?: Environment | object,
  config?: EvaluationConfig
) => void;

export interface Interceptor {
  (evaluation: Evaluation): void;
}

// TODO: will be used to add properties while transfering RemoteValues
export interface EvaluationConfig {
  interceptor?: Interceptor;

  // if true, the interceptor will receive Reference object for Identifiers, not a bare JavaScript values.
  // It's following ECMAScript reference naming guidelines
  useReferences?: boolean;

  // used to catch errors outside of the callstack
  onError?: OnError;
}

export type Continuation = (value: any) => void;
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
