import { assert } from "chai";
import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";

describe("Base interpreters", () => {
  describe("Apply", () => {
    it("should accept calls with function reference only", () => {
      let acceptedArgs;
      function foo(...args) {
        acceptedArgs = args;
      }
      metaesEval({ type: "Apply", fn: foo, args: [1, 2] }, null, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });

    it("should accept calls with function and defined `this` value", () => {
      let acceptedArgs;
      let object = {
        method(...args) {
          acceptedArgs = args;
        }
      };
      metaesEval({ type: "Apply", fn: object.method, thisValue: object, args: [1, 2] }, null, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });

    it("returns input values immediately if they are not eligible for evaluation", function () {
      [{}, undefined, 1, false, Symbol(), ["foo"]].forEach((value) =>
        metaesEval(
          value,
          (result) => assert.equal(result, value),
          (e) => {
            throw e;
          }
        )
      );
    });

    it("evaluates correct AST node", function () {
      metaesEval(
        { type: "Identifier", name: "a" },
        (result) => assert.equal(result, 44),
        (e) => {
          throw e;
        },
        { a: 44 }
      );
    });

    it("throws on incorrect AST node", function () {
      assert.throws(function () {
        metaesEval(
          { type: "Non existing type" },
          (result) => assert.equal(result, 44),
          (e) => {
            assert.equal(e.message, `"Non existing type" node type interpreter is not defined yet.`);
            throw e;
          }
        );
      });
    });

    it("throws on script with nonexisting AST node type", function () {
      assert.throws(function () {
        metaesEval({ scriptId: 0, source: {}, ast: { type: "Non existing type" } }, console.log, (e) => {
          assert.equal(e.message, `"Non existing type" node type interpreter is not defined yet.`);
          throw e;
        });
      });
    });

    it("throws on script with empty `ast` field", function () {
      assert.throws(function () {
        metaesEval({ scriptId: 0, source: {}, ast: null }, console.log, (e) => {
          throw e;
        });
      });
    });
  });
});
