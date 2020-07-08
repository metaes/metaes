import { assert } from "chai";
import { Evaluate } from "lib/types";
import { before, describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { getMetaMetaESEval } from "../../lib/metametaes";
import { evaluateHelper } from "./testUtils";

async function evaluateHelperWithPrint(evalFn, input, name?) {
  try {
    return await evaluateHelper(evalFn, input, name, { values: {} });
  } catch (e) {
    // console.log("e", e);
    console.log(presentException(e));
    throw e.value;
  }
}

describe("Meta MetaES", function () {
  let metaesEval: Evaluate;

  before(async function () {
    metaesEval = await getMetaMetaESEval({ values: { Object, ReferenceError, Error, Set } });
  });

  it("evaluates binary expression with literals", async function () {
    assert.equal(await evaluateHelperWithPrint(metaesEval, "5+5*5"), 30);
  });

  it("throws ReferenceError for non-existing ReferenceError", async function () {
    const metaesEval = await getMetaMetaESEval({ values: { Object, Error, Set } });
    try {
      await evaluateHelperWithPrint(metaesEval, "5+5*a");
    } catch (e) {
      assert.instanceOf(e, ReferenceError);
      assert.equal(e.message, '"ReferenceError" is not defined.');
    }
  });

  it("throws ReferenceError for 'a'", async function () {
    try {
      await evaluateHelperWithPrint(metaesEval, "5+5*a");
    } catch (e) {
      assert.instanceOf(e, ReferenceError);
      assert.equal(e.message, '"a" is not defined.');
    }
  });
});
