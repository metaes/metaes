import { assert } from "chai";
import * as fs from "fs-extra";
import * as glob from "glob";
import { zip } from "lodash";
import { before, describe, it } from "mocha";
import * as pify from "pify";
import { callcc } from "../../lib/callcc";
import { getEnvironmentBy } from "../../lib/environment";
import { presentException } from "../../lib/exceptions";
import { ExportEnvironmentSymbol } from "../../lib/interpreter/modules";
import { createScript } from "../../lib/metaes";
import { Environment, Evaluate } from "../../lib/types";

export const evaluateHelper = (
  evalFn: Evaluate,
  input: string,
  name = "anonymous",
  env: Environment = { values: {} }
) =>
  new Promise((resolve, reject) => {
    const script = createScript(input);
    script.url = name;
    evalFn(script, resolve, reject, env);
  });

const globalEnv = {
  values: {
    assert,
    callcc,
    getExports(_, c, cerr, env) {
      const exportsEnv = getEnvironmentBy(env, (env) => env[ExportEnvironmentSymbol]);
      if (exportsEnv) {
        c(exportsEnv.values);
      } else {
        cerr(new Error("Couldn't find exports."));
      }
    }
  },
  prev: { values: global }
};

export function buildTests(folder: string, evalFn: Evaluate, testNamePrefix = "", logError = true) {
  // generate tests on runtime
  before(async () => {
    const files = (await pify(glob)(`${folder}/*.spec.js`)).map(async (file) => ({
      name: file,
      contents: (await fs.readFile(file)).toString()
    }));
    return (await Promise.all(files)).forEach(({ contents, name }) => {
      const fileName = name;
      const testNames = contents.match(/\/\/ test: [^\n]+\n/g);
      const tests = contents.split(/\/\/ test: .+\n/).filter((line) => line.length);
      const suiteName = name.substring(name.lastIndexOf("/") + 1);

      describe(`${testNamePrefix} ${suiteName}`, () => {
        zip(testNames, tests).forEach(([name, value]) => {
          if (name.includes(":skip")) {
            return;
          }
          const testName = `${testNamePrefix} ${name.replace("// test:", "").trim()}`;
          it(testName, async () => {
            try {
              await evaluateHelper(evalFn, value, fileName, { values: {}, prev: globalEnv });
            } catch (e) {
              if (logError) {
                console.log(e);
              }
              const message = presentException(e);
              console.log(message);
              throw new Error(message);
            }
          });
        });
      });
    });
  });

  // it is a placeholder to force mocha to run `before` function
  it("noop", () => {});
}
