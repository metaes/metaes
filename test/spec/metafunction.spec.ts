import { assert, expect } from "chai";
import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";

describe("Meta functions", () => {
  it("should return correct value in simple case", () => {
    let forms = [
      "(a, b) => a + b",
      (a, b) => a + b,
      function(a, b) {
        return a + b;
      }
    ];
    forms.forEach(form => metaesEval(form, adderFn => assert.equal(adderFn(1, 2), 3)));
  });

  it("should throw an error", () => {
    let _fn;
    metaesEval(
      () => {
        throw new Error("should have happened");
      },
      fn => (_fn = fn),
      undefined,
      { values: { Error } } // global contains constructor for Error
    );
    expect(_fn).to.throw();
  });

  it("should throw an error from external function", () => {
    function thrower() {
      throw new Error();
    }
    let _fn;
    metaesEval(
      () => thrower(),
      fn => (_fn = fn),
      e => {
        console.log("error", e);
      },
      { thrower }
    );
    expect(_fn).to.throw();
  });

  it("should throw an receive the same error from external function", () => {
    const message = "A message";
    const errorConstructor = TypeError;
    function thrower() {
      throw new errorConstructor(message);
    }
    let fn;
    metaesEval(
      () => thrower(),
      result => {
        fn = result;
      },
      e => {
        console.log("error", e);
      },
      { thrower }
    );
    try {
      fn();
    } catch (e) {
      assert.equal(e.value.message, message);
      assert.instanceOf(e.value, errorConstructor);
    }
  });
});
