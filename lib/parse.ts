import * as esprima from "esprima";
import { ParseError, Range } from "./types";
import { Program } from "./nodeTypes";

export type Parser = (source: string) => Program;

export const parse: Parser = (source: string): Program => {
  try {
    return esprima.parse(source, {
      range: true,
      comment: true,
      attachComment: true,
      loc: true,
      source: true
    });
  } catch (e) {
    throw new ParseError(e);
  }
};

export let defaultSource = (source: string) => (range: Range) =>
  source.substring(range[0], range[1]);
