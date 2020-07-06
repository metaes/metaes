import { assert } from "chai";
import { Evaluate } from "lib/types";
import { before, describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { getMetaMetaESEval } from "../../lib/metametaes";
import { evaluateHelper } from "../runner";

async function evaluateHelperWithPrint(evalFn, input, name?) {
  try {
    return await evaluateHelper(evalFn, input, name);
  } catch (e) {
    console.log(presentException(e));
    throw e;
  }
}
describe("Meta MetaES", function () {
  let metaesEval: Evaluate;

  before(async function () {
    metaesEval = await getMetaMetaESEval();
  });
  it("evaluates binary expression with literals", async function () {
    assert.equal(await evaluateHelperWithPrint(metaesEval, "5+5*5"), 30);
  });
});
