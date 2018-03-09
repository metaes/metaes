import { describe, it, beforeEach } from "mocha";
import { assert, expect } from "chai";
import { MetaesContext, evalFunctionBody, ScriptingContext } from "../../lib/metaes";

describe("Evaluation", () => {
  let context: ScriptingContext;
  beforeEach(() => {
    context = new MetaesContext();
  });
  it("success continuation should be called", () => new Promise(resolve => context.evaluate("2", resolve)));

  it("error continuation should be called", () => new Promise(resolve => context.evaluate("throw 1;", null, resolve)));

  it("should not throw in current callstack", () => {
    expect(() => context.evaluate("throw 1;")).to.not.throw();
  });

  it("should be notified once about async error", () =>
    new Promise(resolve => {
      try {
        context.evaluate(
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
    assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: 1 } }), 2);
  });

  it("should correctly execute cooperatively", async () => {
    [1, 2, 3, 4, 5, 6].forEach(async i => {
      assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: i } }), i * 2);
    });
  });
});
