import * as parsingLib from "meriyah";
import { Program } from "./nodeTypes";
import { Range } from "./types";

export type Parser = (source: string, options?: ParserOptions, cache?: ParseCache, module?: boolean) => Program;

interface ParseErrorDetail {
  message: string;
  lineNumber: number;
  description: string;
  index: number;
  column: number;
}

export class ParseError extends Error {
  constructor(public error: ParseErrorDetail) {
    super(error.message);
  }
}

type ParserOptions = {
  range?: boolean;
  comment?: boolean;
  attachComment?: boolean;
  loc?: boolean;
};

function parseWithLib(source: string, options: ParserOptions = {}, module: boolean = false) {
  try {
    const { parse, parseModule } = parsingLib;
    return (module ? parseModule : parse)(source, {
      range: true,
      ranges: true,
      comment: true,
      next: true,
      attachComment: true,
      loc: true,
      ...options
    });
  } catch (e) {
    throw new ParseError(e);
  }
}

export const parse: Parser = (source, options = {}, cache?, module = false) => {
  let ast;
  if (cache) {
    if ((ast = cache.get(source))) {
      return ast;
    } else {
      return cache.set(source, parseWithLib(source, options, module) as Program);
    }
  } else {
    return parseWithLib(source, options, module);
  }
};

export let defaultSource = (source: string) => (range: Range) => source.substring(range[0], range[1]);

export type ParseCache = ReturnType<typeof createCache>;

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
