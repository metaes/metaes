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
import { EvaluateBase } from "../../lib/types";
import { uncpsp } from "./../../lib/metaes";

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

export function buildTests(folder: string, evalFn: EvaluateBase, testNamePrefix = "") {
  before(async () => {
    const files = (await pify(glob)(`${folder}/*.spec.js`)).map(async (file) => ({
      name: file,
      contents: (await fs.readFile(file)).toString()
    }));
    return (await Promise.all(files)).forEach(({ contents, name }) => {
      const testNames = contents.match(/\/\/ test: [^\n]+\n/g);
      const testsSources = contents.split(/\/\/ test: .+\n/).filter((line) => line.length);
      const suiteName = name.substring(name.lastIndexOf("/") + 1);

      describe(`${testNamePrefix} ${suiteName}`, () => {
        zip(testNames, testsSources).forEach(([name, source]) => {
          if (name.includes(":skip")) {
            return;
          }
          const testName = `${testNamePrefix} ${name.replace("// test:", "").trim()}`;
          it(testName, async () => {
            try {
              await uncpsp(evalFn)(source, { values: {}, prev: globalEnv });
            } catch (e) {
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
