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
          return true;
        });
        throw new Error("Didn't throw");
      } catch (e) {
        assert.equal(e.type, "ThrowStatement");
      }
    });

    it("should exit block statement when throwing from function", async () => {
      try {
        await evalFunctionBody(new MetaesContext(), function() {
          (() => {
            throw 1;
          })();
          return true;
        });
        throw new Error("Didn't throw");
      } catch (e) {
        assert.equal(e.type, "ThrowStatement");
      }
    });
  });
});
