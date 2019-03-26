import { assert } from "chai";
import * as fs from "fs-extra";
import * as glob from "glob";
import { zip } from "lodash";
import { before, describe, it } from "mocha";
import * as pify from "pify";
import { metaesEval } from "../lib/metaes";
import { callcc } from "../lib/callcc";

const values = {
  getThisEnv(_, c, _cerr, env) {
    c(env);
  },
  callcc
};

const evaluate = (input: string) =>
  new Promise((resolve, reject) =>
    metaesEval(input, resolve, reject, { values: Object.assign({}, values), prev: { values: global } })
  );

(async () => {
  try {
    describe("From source files tests", async () => {
      // generate tests on runtime
      before(async () => {
        const files = (await pify(glob)(__dirname + "/*.spec.ts")).map(async file => ({
          name: file,
          contents: (await fs.readFile(file)).toString()
        }));

        return (await Promise.all(files)).forEach(({ contents, name }) => {
          const testNames = contents.match(/\/\/ it: [^\n]+\n/g);
          const tests = contents.split(/\/\/ it: .+\n/).filter(line => line.length);
          const suiteName = name.substring(name.lastIndexOf("/") + 1);

          describe(suiteName, () => {
            zip(testNames, tests).forEach(([name, value]) => {
              if (name.includes(":skip")) {
                return;
              }
              const testName = name.replace("// it:", "").trim();
              it(testName, async () => {
                const result = await evaluate(value);
                return assert.isTrue(typeof result === "boolean" && result);
              });
            });
          });
        });
      });

      // it is a placeholder to force mocha to run `before` function
      it("noop", () => {});
    });
  } catch (e) {
    console.log("Source files test error", e);
  }
})();
