import * as esprima from "esprima";
import { Range } from "./types";
import { Program } from "./nodeTypes";

export type Parser = (source: string, options?: ParserOptions) => Program;

interface EsprimaError {
  message: string;
  line: number;
  description: string;
  index: number;
  column: number;
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
