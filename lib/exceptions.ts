import { ASTNode, MetaesException, Script } from "./types";

export const toException = (value: Error | MetaesException, location?: ASTNode): MetaesException =>
  value instanceof Error ? { type: "Error", value, location } : value;

export const NotImplementedException = (message: string, location?: ASTNode): MetaesException => ({
  type: "NotImplemented",
  message,
  location
});

export const LocatedError = (value: any, location: ASTNode): MetaesException => ({ value, location });

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

export function showException(script: Script, { location, value }: MetaesException, useStyles = true) {
  const styled = useStyles ? withStyle : (value) => value;

  if (location) {
    const url = script.url;
    const startLine = location.loc?.start.line;
    const sourceLocation = `${url}:${location.loc?.start.line}:${location.loc?.start.column} - ${value}\n`;

    return (
      sourceLocation +
      script.source
        .split("\n")
        .flatMap((line, i) => {
          const lineOutput = `  ${i + 21}|  ${line}`;
          if (i + 1 === startLine) {
            return [styled(lineOutput, highlight), `             ${styled("~~~", error)}`];
          } else {
            return styled(lineOutput, dim);
          }
        })
        .join("\n")
    );
  } else {
    return value;
  }
}
