import { assert } from "chai";
import { describe, it } from "mocha";
import { evalToPromise, MetaesContext } from "./metaes";

describe("Environment", () => {
  it("should merge two or more environments", async () => {
    const ctx = new MetaesContext(undefined, undefined, { values: { a: 1 } });
    assert.equal(await evalToPromise(ctx, "a"), 1);
    assert.equal(await evalToPromise(ctx, "a", { values: { a: 2 } }), 2);

    assert.deepEqual(await evalToPromise(ctx, "[a,b]", { values: { b: 1 } }), [1, 1]);
    const env1 = { values: { b: 2 } };
    const env2 = { values: { c: 3 }, prev: env1 };

    let exception;
    ctx.evaluate("[a,b,c]", undefined, e => (exception = e), env2);
    assert.instanceOf(exception.value, ReferenceError);

    const env3 = { values: { b: 2 }, prev: ctx.environment };
    const env4 = { values: { c: 3 }, prev: env3 };

    assert.deepEqual(await evalToPromise(ctx, "[a,b,c]", env4), [1, 2, 3]);
  });
});
