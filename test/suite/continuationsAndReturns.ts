import { describe, it } from "mocha";
import { metaESEval } from "../../lib/metaes";
import { assert } from "chai";

describe("Continuations and returns", () => {
  // TODO: use shortcut functions, evaluatePromisified
  it("success continuation should be called", () =>
    new Promise(resolve => metaESEval("2", {}, { errorCallback: _ => {} }, resolve)));

  it("error continuation should be called", () =>
    new Promise(resolve => metaESEval("throw 1;", {}, { errorCallback: _ => {} }, void 0, resolve)));

  it("should not throw in current callstack", () =>
    new Promise((resolve, reject) => {
      let didThrow = false;
      try {
        metaESEval("throw 1;");
      } catch (e) {
        didThrow = true;
      }
      setTimeout(() => (didThrow ? reject() : resolve()), 0);
    }));

  // TODO: really should be? Reevaluate what errorCallback is for.
  it("error callback should be called", () =>
    new Promise(resolve => {
      try {
        metaESEval(
          "console()",
          { setTimeout, console },
          {
            errorCallback: e => {
              assert.equal(true, e.originalError instanceof TypeError);
              resolve();
            }
          },
          _ => {}, // ignore success
          _ => {} // ignore this error
        );
      } catch (e) {}
    }));
});
