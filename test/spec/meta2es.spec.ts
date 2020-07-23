import { assert } from "chai";
import { Evaluate } from "lib/types";
import { before, describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { getMeta2ESEval } from "../../lib/meta2es";
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

describe("Meta2ES", function () {
  let metaesEval: Evaluate;

  before(async function () {
    metaesEval = await getMeta2ESEval({ values: { Object, Error, ReferenceError, Symbol, Date } });
  });

  it("evaluates binary expression with literals", async function () {
    assert.equal(await evaluateHelperWithPrint(metaesEval, "5+5*5"), 30);
  });

  it("throws ReferenceError for 'a'", async function () {
    try {
      await evaluateHelperWithPrint(metaesEval, "5+5*a");
    } catch (e) {
      assert.instanceOf(e, ReferenceError);
      assert.equal(e.message, '"a" is not defined.');
    }
  });

  it("evaluates function", async function () {
    const fn = (await evaluateHelperWithPrint(metaesEval, "function f(x){return x*2}")) as Function;
    assert.typeOf(fn, "function");
    assert.equal(fn(22), 44);
  });

  it("throws ReferenceError for non-existing ReferenceError", async function () {
    const metaesEval = await getMeta2ESEval({ values: { Object, Date } });
    try {
      await evaluateHelperWithPrint(metaesEval, "a");
    } catch (e) {
      assert.instanceOf(e, ReferenceError);
      assert.equal(e.message, '"ReferenceError" is not defined.');
    }
  });
});
