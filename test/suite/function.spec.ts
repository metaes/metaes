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

  it("should throw an error", () =>
    new Promise(resolve =>
      metaesEval(
        () => {
          throw new Error("should have happened");
        },
        fn => {
          expect(fn).to.throw();
          resolve();
        },
        e => {
          console.log(e);
        },
        global // global contains constructor for Error
      )
    ));

  it("should throw an error from external function", () => {
    function thrower() {
      throw new Error();
    }
    metaesEval(
      () => thrower(),
      fn => {
        expect(fn).to.throw();
      },
      e => {
        console.log("error", e);
      },
      { thrower }
    );
  });

  describe("Differentiate betten call from metaes and from native JS", () => {
    it("should pass config when calling form Metaes", () => {
      let fn;
      metaesEval(
        c => c(),
        _fn => {
          fn = _fn;
        },
        e => {
          console.log("error", e);
        },
        { setTimeout }
      );
      expect(fn).to.throw();
    });
    it("should not pass config when calling form native JS ", () => {
      let fn;
      metaesEval(
        c => c(),
        _fn => {
          fn = _fn;
        },
        e => {
          console.log("error", e);
        },
        { setTimeout }
      );
      metaesEval(
        "fn()",
        null,
        e => {
          console.log("error", e);
        },
        { fn },
        {
          onError: e => {
            console.log("on error", e);
          }
        }
      );
    });
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
      assert.equal(e.message, message);
      assert.instanceOf(e, errorConstructor);
    }
  });
});
