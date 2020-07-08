import { evaluateHelper } from "../test/spec/testUtils";
import { presentException } from "./exceptions";
import { getMetaMetaESEval } from "./metametaes";

async function evaluateHelperWithPrint(evalFn, input, name?, env?) {
  try {
    return await evaluateHelper(evalFn, input, name, env);
  } catch (e) {
    console.log("e", e);
    console.log(presentException(e));
    throw e;
  }
}

(async function () {
  const metaesEval = await getMetaMetaESEval({ values: { ReferenceError, Error, Set } });
  console.log(await evaluateHelperWithPrint(metaesEval, "5+5*a", "unnamed", { a: 5 }));
})();
