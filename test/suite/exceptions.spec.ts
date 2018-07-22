import { describe, it } from "mocha";
import { evalFunctionBody, MetaesContext, metaesEval } from "../../lib/metaes";
import { assert } from "chai";

describe("Exceptions", () => {
  it("should throw ReferenceError", () =>
    new Promise((resolve, _reject) => {
      metaesEval(`a`, null, x => {
        assert.equal(x.type, "ReferenceError");
        resolve();
      });
    }));

  describe("From host functions", () => {});
  describe("From MetaES functions", () => {});

  describe("From blocks", () => {
    it("should exit block statement", async () => {
      try {
        await evalFunctionBody(new MetaesContext(), function() {
          throw 1;
        });
        throw new Error("Didn't throw");
      } catch (e) {
        assert.equal(e.type, "ThrowStatement");
      }
    });

    it("should exit block statement when throwing from nested function", async () => {
      try {
        await evalFunctionBody(new MetaesContext(), function() {
          (() => {
            throw 1;
          })();
        });
      } catch (e) {
        assert.equal(e.type, "ThrowStatement");
      }
    });

    it("should continue after try/catch block", async () => {
      const result = await evalFunctionBody(new MetaesContext(), function() {
        try {
          (async () => {
            throw 1;
          })();
        } catch (e) {
          // ignore
        }
        "hello";
      });
      assert.equal(result, "hello");
    });

    it("should catch any error in try statement", async () => {
      // declare variable to stop TypeScript warnings
      let a;
      const result = await evalFunctionBody(new MetaesContext(), function() {
        let error;
        try {
          a; //
        } catch (e) {
          error = e;
        }
        error;
      });
      assert.isTrue(result instanceof ReferenceError);
    });
  });
});
