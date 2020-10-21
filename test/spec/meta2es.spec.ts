import { assert } from "chai";
import { Evaluate } from "lib/types";
import { before, describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { getMeta2ESEval } from "../../lib/meta2es";
import { evaluateHelper } from "./testUtils";

async function evaluateHelperWithPrint(evalFn, input, name?, env = { values: {} }) {
  try {
    return await evaluateHelper(evalFn, input, name, env);
  } catch (e) {
    console.log(presentException(e));
    throw e;
  }
}

describe("Meta2ES", function () {
  let metaesEval: Evaluate;

  before(async function () {
    metaesEval = await getMeta2ESEval({
      values: { Object, Error, ReferenceError, Symbol, Date, Set, undefined, console, Function }
    });
  });

  it("supports function call", async function () {
    assert.equal(await evaluateHelperWithPrint(metaesEval, "(x=>x+1)(1)"), 2);
  });

  it("runs metafunction from native function", async function () {
    assert.deepEqual(
      await evaluateHelperWithPrint(
        metaesEval,
        "const f = d=>{ console.log({d}); return d>1}; globalThis.f=f; [1, 2].filter(d=>{ console.log({d}); return d>1})",
        null,
        { values: { globalThis, console } }
      ),
      [2]
    );
  });

  it("evaluates binary expression with literals", async function () {
    assert.equal(await evaluateHelperWithPrint(metaesEval, "5+5*5"), 30);
  });

  it("throws ReferenceError for 'a'", async function () {
    try {
      await evaluateHelperWithPrint(metaesEval, "5+5*a");
    } catch (e) {
      assert.instanceOf(e.value, ReferenceError);
      assert.equal(e.value.message, '"a" is not defined.');
    }
  });

  it("evaluates function", async function () {
    const fn = (await evaluateHelperWithPrint(metaesEval, "function f(x){return x*2}")) as Function;
    assert.typeOf(fn, "function");
    assert.equal(fn(22), 44);
  });

  it("throws ReferenceError for non-existing ReferenceError", async function () {
    const metaesEval = await getMeta2ESEval({ values: { Object, Function } });
    try {
      await evaluateHelperWithPrint(metaesEval, "a");
    } catch (e) {
      assert.instanceOf(e, ReferenceError);
      assert.equal(e.message, '"ReferenceError" is not defined.');
    }
  });
});
