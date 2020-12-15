import { assert, expect } from "chai";
import { describe, it } from "mocha";
import { bindArgs, evalFnBody, metaesEval, uncps, uncpsp } from "./../../lib/metaes";

describe("Evaluation", () => {
  const evalFnBodyAsPromise = uncpsp(evalFnBody(metaesEval));

  it("success continuation should be called", () => new Promise((resolve) => metaesEval("2", resolve)));

  it("error continuation should be called", () => new Promise((resolve) => metaesEval("throw 1;", null, resolve)));

  it("should not throw in current callstack", () => {
    expect(() => metaesEval("throw 1;")).to.not.throw();
  });

  it("should correctly execute scripting context", async () => {
    assert.equal(await evalFnBodyAsPromise((a) => a * 2, { values: { a: 1 } }), 2);
  });

  it("should correctly execute cooperatively", async () => {
    [1, 2, 3, 4, 5, 6].forEach(async (i) =>
      assert.equal(await evalFnBodyAsPromise((a) => a * 2, { values: { a: i } }), i * 2)
    );
  });
});

describe("transforms cps-style function into return/throw one", function () {
  it("supports return", function () {
    assert.equal(uncps(metaesEval)("2+a", { a: 2 }), 4);
  });

  it("supports throw", function () {
    let thrown;
    try {
      uncps(metaesEval)("throw a", { a: 2 });
    } catch (exception) {
      thrown = exception.value;
    }
    assert.equal(thrown, 2);
  });
});

describe("bindArgs", function () {
  it("binds args", function () {
    const oneAndTwo = bindArgs(1, 2);
    const add = (a, b) => a + b;

    assert.equal(oneAndTwo(add), 3);
  });
});
