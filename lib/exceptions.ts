import { ASTNode, MetaesException, Script } from "./types";

function isException(value: any): value is MetaesException {
  return value && typeof value === "object" && !(value instanceof Error);
}

export const toException = <T>(value: T | MetaesException, location?: ASTNode, script?: Script) =>
  isException(value) ? value : <const>{ type: "Error", value, location, script };

export const NotImplementedException = (message: string, location?: ASTNode) =>
  <const>{
    type: "Error",
    message,
    value: new Error(message),
    location
  };

export const LocatedException = (value: any, location: ASTNode) => <const>{ type: "Error", value, location };

const highlight = (text: string) => `\x1b[1m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const error = (text: string) => `\x1b[91m${text}\x1b[0m`;

function withStyle(text: string, style: (string) => string) {
  return style(text);
}

export function presentException({ location, value, message, script }: MetaesException, useStyles = true) {
  let output = "";
  if (isException(value)) {
    output += presentException(value, useStyles) + "\n";
  }
  if (location) {
    const styled = useStyles ? withStyle : (value) => value;
    const source = typeof script.source === "function" ? script.source.toString() : script.source;
    const url = script.url ?? "anonymous";
    const startLine = location.loc?.start.line!;
    const startColumn = location.loc?.start.column!;
    const nodeLength = location.range ? location.range[1] - location.range[0] : 1;
    const sourceLocation = `${url}:${startLine}:${startColumn} - ${
      (isException(value) ? message : value) || message
    }\n\n`;
    const lines = source.split("\n");
    const line = lines[startLine - 1];
    const lineNumber = styled(startLine + "|", dim);
    const lineValue = styled(line, highlight);
    const lineNumberSize = startLine?.toString().length || 0;
    const paddingSum = 5;
    return (
      output +
      (sourceLocation +
        `  ${lineNumber}  ${lineValue}` +
        "\n" +
        `${" ".repeat(paddingSum + lineNumberSize + startColumn)}${styled("~".repeat(nodeLength), error)}`)
    );
  } else {
    return output + value;
  }
}
