import { ASTNode, MetaesException, Script } from "./types";

function isException(value: any): value is MetaesException {
  return value && typeof value === "object" && !(value instanceof Error);
}

export const toException = (value: any | MetaesException, location?: ASTNode, script?: Script) =>
  isException(value) ? value : { type: "Error", value, location, script };

export const NotImplementedException = (message: string, location?: ASTNode) => ({
  type: "NotImplemented",
  message,
  location
});

export const LocatedError = (value: any, location: ASTNode) => ({ value, location });

function highlight(text: string) {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text: string) {
  return `\x1b[2m${text}\x1b[0m`;
}

function error(text: string) {
  return `\x1b[91m${text}\x1b[0m`;
}

function withStyle(text: string, style: (string) => string) {
  return style(text);
}

export function presentException({ location, value, message, script }: MetaesException, useStyles = true) {
  const styled = useStyles ? withStyle : (value) => value;
  const source = typeof script.source === "function" ? script.source.toString() : script.source;
  const url = script.url ?? "anonymous";

  if (location) {
    const startLine = location.loc?.start.line!;
    const startColumn = location.loc?.start.column!;
    const nodeLength = location.range ? location.range[1] - location.range[0] : 1;
    const sourceLocation = `${url}:${location.loc?.start.line}:${location.loc?.start.column} - ${value || message}\n\n`;
    const lines = source.split("\n");
    const line = lines[startLine - 1];
    const lineNumber = styled(startLine + "|", dim);
    const lineValue = styled(line, highlight);
    const lineNumberSize = startLine.toString().length;
    const paddingSum = 5;
    // console.log(
    //   source
    //     .split("\n")
    //     .map((line, i) => `${i + 1}| ${line}`)
    //     .join("\n")
    // );
    console.log(JSON.stringify(value || message).substring(0, 1000));
    return (
      sourceLocation +
      `  ${lineNumber}  ${lineValue}` +
      "\n" +
      `${" ".repeat(paddingSum + lineNumberSize + startColumn)}${styled("~".repeat(nodeLength), error)}`
    );
  } else {
    return value;
  }
}
