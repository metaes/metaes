import { describe, it } from "mocha";
import { assert } from "chai";
import { metaesEval, MetaesContext, evalFunctionBody } from "../../lib/metaes";

describe("Evaluation", () => {
  it("success continuation should be called", () => new Promise(resolve => metaesEval("2", resolve)));

  it("error continuation should be called", () => new Promise(resolve => metaesEval("throw 1;", null, resolve)));

  it("should not throw in current callstack", () =>
    new Promise((resolve, reject) => {
      let didThrow = false;
      try {
        metaesEval("throw 1;");
      } catch (e) {
        didThrow = true;
      }
      setTimeout(() => (didThrow ? reject() : resolve()), 0);
    }));

  it("should be notified once about async error", () =>
    new Promise(resolve => {
      try {
        metaesEval(
          "setTimeout(()=>console())", // should throw, `console` is not a function
          null,
          null,
          { setTimeout, console },
          {
            // FIX: this handler should be called only once.
            onError(e) {
              if (e instanceof TypeError) {
                resolve();
              }
            }
          }
        );
      } catch (e) {
        console.log("caught and ignored:", e);
      }
    }));

  it("should correctly execute scripting context", async () => {
    const context = new MetaesContext(undefined, undefined, { values: global });
    assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: 1 } }), 2);
  });

  it("should correctly execute cooperatively", async () => {
    const context = new MetaesContext(undefined, undefined, { values: global });
    [1, 2, 3, 4, 5, 6].forEach(async i => {
      assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: i } }), i * 2);
    });
  });
});
