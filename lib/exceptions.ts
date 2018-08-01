import { ASTNode } from "./nodes/nodes";
import { MetaesException } from "./types";

export const toException = (value: Error | MetaesException, location?: ASTNode): MetaesException =>
  value instanceof Error ? { type: "Error", value, location } : value;

export const NotImplementedException = (message: string, location?: ASTNode): MetaesException => ({
  type: "NotImplemented",
  message,
  location
});

export const LocatedError = (value: any, location: ASTNode): MetaesException => ({ value, location });
export const LocatedException = (message: string, location: ASTNode): MetaesException => ({ message, location });
