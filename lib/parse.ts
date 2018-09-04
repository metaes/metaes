import * as esprima from "esprima";
import { Range, ParsedSource, Source } from "./types";
import { Program } from "./nodeTypes";
import { ASTNode } from "./nodes/nodes";

export type Parser = (source: string, options?: ParserOptions) => Program;

interface EsprimaError {
  message: string;
  lineNumber: number;
  description: string;
  index: number;
  column: number;
}

export function isParsedSource(source: Source): source is ParsedSource {
  return typeof source === "object" && ("raw" in source && "ast" in source);
}

export class ParseError extends Error {
  constructor(public error: EsprimaError) {
    super(error.message);
  }
}

type ParserOptions = {
  range?: boolean;
  comment?: boolean;
  attachComment?: boolean;
  loc?: boolean;
  source?: boolean;
};

export const parse: Parser = (source: string, options: ParserOptions = {}): Program => {
  try {
    return esprima.parse(
      source,
      Object.assign(
        {
          range: true,
          comment: true,
          attachComment: true,
          loc: true,
          source: true
        },
        options
      )
    );
  } catch (e) {
    throw new ParseError(e);
  }
};

export let defaultSource = (source: string) => (range: Range) => source.substring(range[0], range[1]);

export function createCache() {
  const cache: { [key: string]: Program } = {};
  return {
    get(source: string) {
      return cache[source];
    },
    set(source: string, value: Program) {
      return (cache[source] = value);
    }
  };
}

export const createCachedParse = (cache: ReturnType<typeof createCache>) => (
  source: string,
  options: ParserOptions = {}
) => cache[source] || cache.set(source, parse(source, options));
