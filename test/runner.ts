import { assert } from "chai";
import * as fs from "fs-extra";
import * as glob from "glob";
import { zip } from "lodash";
import { before, describe, it } from "mocha";
import * as pify from "pify";
import { callcc } from "../lib/callcc";
import { getEnvironmentBy } from "../lib/environment";
import { ExportEnvironmentSymbol } from "../lib/interpreter/modules";
import { metaesEval, metaesEvalModule } from "../lib/metaes";

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

const evaluate = (evalFn, input: string) =>
  new Promise((resolve, reject) => evalFn(input, resolve, reject, { values: {}, prev: globalEnv }));

function build(folder: string, fn) {
  // generate tests on runtime
  before(async () => {
    const files = (await pify(glob)(__dirname + `/${folder}/*.spec.js`)).map(async (file) => ({
      name: file,
      contents: (await fs.readFile(file)).toString()
    }));
    return (await Promise.all(files)).forEach(({ contents, name }) => {
      const testNames = contents.match(/\/\/ test: [^\n]+\n/g);
      const tests = contents.split(/\/\/ test: .+\n/).filter((line) => line.length);
      const suiteName = name.substring(name.lastIndexOf("/") + 1);

      describe(suiteName, () => {
        zip(testNames, tests).forEach(([name, value]) => {
          if (name.includes(":skip")) {
            return;
          }
          const testName = name.replace("// test:", "").trim();
          it(testName, async () => {
            try {
              await evaluate(fn, value);
            } catch (e) {
              throw e.value || e;
            }
          });
        });
      });
    });
  });

  // it is a placeholder to force mocha to run `before` function
  it("noop", () => {});
}
(async () => {
  try {
    describe("metaesEval", () => build("eval", metaesEval));
    describe("metaesEvalModule", () => build("eval_module", metaesEvalModule));
  } catch (e) {
    console.log("Source files test error", e);
  }
})();
