import {ASTNode} from "./nodes/nodes";
import {Environment, Reference} from "./environment";

export class ParseError extends Error {
  line: number;
  description: string;
  index: number;
  column: number;

  constructor(public error: Error) {
    super(error.message);
    this.line = error['line'];
    this.description = error['description'];
    this.index = error['index'];
    this.column = error['column'];
  }
}

export class NotImplementedYet extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Just means that MetaES interpreter is aware of this error happened.
 */
export class MetaESError extends Error {
  constructor(public originalError: Error) {
    super(originalError.message);
  }
}

export class LocatedError extends MetaESError {
  constructor(public node: ASTNode, public originalError: Error) {
    super(originalError);
  }
}

export type Range = [number, number];

export type SuccessValue = { node: ASTNode, value: any };
export type SuccessCallback = (value: SuccessValue) => void;
export type ErrorCallback = (e: LocatedError) => void

/**
 * enter - before ASTNode was evaluated
 * exit - after ASTNode was evaluated
 */
export type EvaluationType = 'enter' | 'exit';

export type EvaluationValue = any | Reference;

export interface Evaluation {
  e: ASTNode;
  value: EvaluationValue;
  env: Environment;
  type: EvaluationType;
  timestamp: number;
}

export interface Interceptor {
  (evaluation: Evaluation): void;
}

export interface EvaluationConfig {
  interceptor?: Interceptor;

  // name of the VM, can be filename or just any arbitrary name.
  // Leaving it undefined will by default assign name like VMx where `x` is next natural number.
  name?: string;

  // if true, the interceptor will receive Reference object for Identifiers, not a bare JavaScript values.
  // It's following ECMAScript reference naming guidelines
  useReferences?: boolean;

  // used to catch errors outside of the callstack
  errorCallback: ErrorCallback;
}

export type Continuation = (value: any) => void;
export type ErrorContinuation = (error: Error) => void;

type Interpreter<T extends ASTNode> = (e: T,
                                       env: Environment,
                                       config: EvaluationConfig,
                                       c: Continuation,
                                       cerr: ErrorContinuation) => void;

export type interpretersMap = {
  [key: string]: Interpreter<any>
};
