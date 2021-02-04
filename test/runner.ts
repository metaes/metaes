import { ImportModuleName } from "./../lib/interpreter/modules";
import { Evaluate } from "lib/types";
import { describe } from "mocha";
import * as path from "path";
import { getMeta2ESEval } from "../lib/meta2es";
import { metaesEval, metaesEvalModule } from "../lib/metaes";
import { createScript } from "../lib/script";
import { buildTests } from "./spec/testUtils";
import { readFile } from "fs";

(async () => {
  try {
    const prefix = __dirname;

    const meta2Eval = (await getMeta2ESEval({
      values: {
        ReferenceError,
        Error,
        Set,
        Object,
        undefined,
        Array,
        TypeError,
        Function,
        console,
        Promise,
        Date,
        Symbol
      }
    })) as Evaluate;

    describe("metaesEval", () => buildTests(path.join(prefix, "eval"), metaesEval));
    describe("meta2esEval", () => buildTests(path.join(prefix, "eval"), meta2Eval, "[meta2]"));

    const dir = path.join(prefix, "eval_module");

    describe("metaesEvalModule", () =>
      buildTests(dir, function (input: string, c, cerr, env, config) {
        const script = createScript(input, undefined, "module");
        metaesEvalModule(
          script,
          c,
          cerr,
          {
            values: {
              // This simplified import system supports only one level of importing.
              // TODO: integrate with meta2es logic which is more advanced.
              [ImportModuleName](url, c, cerr) {
                const fullUrl = path.join(dir, url + ".js");
                readFile(fullUrl, (err, data) => {
                  if (err) {
                    cerr(err);
                  } else {
                    const s = createScript(data + "", undefined, "module");
                    s.url = fullUrl;
                    metaesEvalModule(s, c, cerr);
                  }
                });
              }
            },
            prev: env
          },
          config
        );
      }));
    // describe("meta2esEvalModule", () => buildTests(path.join(prefix, "eval_module"), meta2Eval, "[meta2]"));
  } catch (e) {
    console.log("Source files test error", e);
  }
})();
