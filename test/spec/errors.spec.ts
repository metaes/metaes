import { MetaesException, Script } from "lib/types";
import { describe, it } from "mocha";
import { createScript, metaesEval } from "../../lib/metaes";

function showError(script: Script, { location, value }: MetaesException) {
  if (location) {
    const url = script.url;
    const startLine = location.loc?.start.line;
    const sourceLocation = `${url}:${location.loc?.start.line}:${location.loc?.start.column} \n`;

    console.log("\n" + sourceLocation);
    console.log(
      script.source
        .split("\n")
        .flatMap((line, i) => {
          const lineOutput = `  ${i + 21}|  ${line}`;
          if (i + 1 === startLine) {
            return [`\x1b[1m${lineOutput}\x1b[0m`, `\t     \x1b[91m~~~\x1b[39m \x1b[41m[${value}]\x1b[0m`];
          } else {
            return `\x1b[2m${lineOutput}\x1b[0m`;
          }
        })
        .join("\n")
    );
  } else {
    return value;
  }
}

describe.only("Errors printing", function () {
  it("prints error", function () {
    const source = `function run(){
  2 + lol / 4;
}
run();`;
    const script = createScript(source);
    script.url = `test/from-html.spec.ts`;

    metaesEval(source, console.log, function (error) {
      console.log(showError(script, error));
    });
  });
});
