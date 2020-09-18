import { Evaluate } from "lib/types";
import { describe } from "mocha";
import * as path from "path";
import { getMeta2ESEval } from "../lib/meta2es";
import { metaesEval, metaesEvalModule } from "../lib/metaes";
import { buildTests } from "./spec/testUtils";

(async () => {
  try {
    const prefix = __dirname;
    
    describe("metaesEval", () => buildTests(path.join(prefix, "eval"), metaesEval));
    describe("metaesEvalModule", () => buildTests(path.join(prefix, "eval_module"), metaesEvalModule));

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
    describe("meta2esEval", () => buildTests(path.join(prefix, "eval"), meta2Eval, "[meta2]", false));
    describe("meta2esEvalModule", () => buildTests(path.join(prefix, "eval_module"), meta2Eval, "[meta2]", false));
  } catch (e) {
    console.log("Source files test error", e);
  }
})();
