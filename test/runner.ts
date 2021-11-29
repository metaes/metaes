import { readFile } from "fs";
import { describe } from "mocha";
import * as path from "path";
import { createEnvironment } from "../lib/environment";
import { toException } from "../lib/exceptions";
import { getMeta2ESEval } from "../lib/meta2es";
import { metaesEval } from "../lib/metaes";
import { createScript } from "../lib/script";
import { createModulesImporter } from "./../lib/interpreter/modules";
import { intristic } from "./../lib/names";
import { Continuation, ErrorContinuation } from "./../lib/types";
import { buildTests } from "./spec/testUtils";

(async () => {
  try {
    const prefix = __dirname;

    const meta2Eval = await getMeta2ESEval({
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
    });

    describe("metaesEval", () => buildTests(path.join(prefix, "eval"), metaesEval));
    describe("meta2esEval", () => buildTests(path.join(prefix, "eval"), meta2Eval, "[meta2]"));

    const dir = path.join(prefix, "eval_module");
    const mainModuleName = "main.js";

    describe("metaesEvalModule", () =>
      buildTests(dir, function (input: string, c: Continuation<{ [key: string]: any }>, cerr: ErrorContinuation, env) {
        const importer = createModulesImporter(
          createEnvironment(
            {
              values: {
                [intristic.URLToScript]([url, base], c, cerr: ErrorContinuation) {
                  if (url === mainModuleName) {
                    const script = createScript(input, undefined, "module");
                    script.url = mainModuleName;
                    c({ script, resolvedPath: path.join(base, mainModuleName) });
                  } else {
                    const fullUrl = path.join(path.parse(base).dir, url + ".js");

                    readFile(fullUrl, (err, data) => {
                      if (err) {
                        cerr(toException(err));
                      } else {
                        const script = createScript(data + "", undefined, "module");
                        script.url = fullUrl;
                        c({ script, resolvedPath: fullUrl });
                      }
                    });
                  }
                }
              }
            },
            env
          )
        )(dir);

        importer(mainModuleName, c, cerr);
      }));
    // describe("meta2esEvalModule", () => buildTests(path.join(prefix, "eval_module"), meta2Eval, "[meta2]"));
  } catch (e) {
    console.log("Source files test error", e);
  }
})();
