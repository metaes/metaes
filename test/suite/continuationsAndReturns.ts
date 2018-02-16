import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";
import { assert } from "chai";

describe("Continuations and returns", () => {
  // TODO: use shortcut functions, evaluatePromisified
  it("success continuation should be called", () => new Promise(resolve => metaesEval("2", resolve)));

  it("error continuation should be called", () => new Promise(resolve => metaesEval("throw 1;", undefined, resolve)));

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

  it("should be notified about late error", () =>
    new Promise(resolve => {
      try {
        metaesEval(
          "setTimeout(()=>console())",
          _ => {}, // ignore success
          _ => {}, // ignore this error
          { setTimeout, console },
          {
            onError(e) {
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
