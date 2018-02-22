import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";
import { assert, expect } from "chai";

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
    metaesEval(
      () => {
        throw new Error("should have happened");
      },
      fn => {
        expect(fn).to.throw();
      },
      null,
      global // global contains constructor for Error
    );
  });
});
