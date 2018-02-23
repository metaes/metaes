import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";
import { assert } from "chai";

describe("Continuations and returns", () => {
  // TODO: use shortcut functions, evaluatePromisified
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

  it.skip("should be notified once about async error", () =>
    new Promise(resolve => {
      try {
        metaesEval(
          "setTimeout(()=>console())", // should throw, `console` is not a function
          null,
          null,
          { setTimeout, console },
          {
            onError(e) {
              console.log("got it", e);
              assert.equal(true, e.originalError instanceof TypeError);
              resolve();
            }
          }
        );
      } catch (e) {
        console.log("caught and ignored:", e);
      }
    }));
});
