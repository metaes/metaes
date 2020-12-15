import { assert } from "chai";
import { describe, it } from "mocha";
import { MetaesContext, metaesEval, uncps } from "../../lib/metaes";

describe("Environment", () => {
  it("should merge two or more environments", async () => {
    const evalFn = uncps(metaesEval);

    const env0 = { values: { a: 1 } };
    const ctx = new MetaesContext(undefined, undefined, { values: { a: 1 } });
    assert.equal(evalFn("a", env0), 1);
    assert.equal(evalFn("a", { values: { a: 2 } }), 2);

    assert.deepEqual(evalFn("[a,b]", { values: { b: 1 }, prev: env0 }), [1, 1]);
    const env1 = { values: { b: 2 }, prev: env0 };
    const env2 = { values: { c: 3 }, prev: env1 };

    try {
      evalFn("[a,b,c]", env2);
    } catch (exception) {
      assert.instanceOf(exception.value, ReferenceError);
    }

    const env3 = { values: { b: 2 }, prev: ctx.environment };
    const env4 = { values: { c: 3 }, prev: env3 };

    assert.deepEqual(evalFn("[a,b,c]", env4), [1, 2, 3]);
  });
});
