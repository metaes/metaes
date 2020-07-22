import { assert } from "chai";
import { describe, it } from "mocha";
import { ECMAScriptInterpreters } from "../../lib/interpreters";
import { evalFnBodyAsPromise, MetaesContext, metaesEval, noop } from "../../lib/metaes";

describe("Exceptions", () => {
  it("should throw on AwaitExpression use", () =>
    new Promise((resolve, reject) => {
      metaesEval(
        `(async ()=>await 2)()`,
        reject,
        resolve,
        {},
        {
          interpreters: {
            values: Object.fromEntries(
              Object.entries(ECMAScriptInterpreters.values).filter(([k]) => k !== "AwaitExpression")
            )
          }
        }
      );
    }));

  it("should throw ReferenceError", () =>
    new Promise((resolve, _reject) => {
      metaesEval("a", noop, function (error) {
        assert.equal(error.value.message, `"a" is not defined.`);
        assert.equal(error.type, "Error");
        resolve();
      });
    }));

  describe("From blocks", () => {
    it("should exit block statement", async () => {
      try {
        await evalFnBodyAsPromise({
          context: new MetaesContext(),
          source: function () {
            throw 1;
          }
        });
        throw new Error("Didn't throw");
      } catch (e) {
        assert.equal(e.type, "Error");
      }
    });

    it("should exit block statement when throwing from nested function", async () => {
      try {
        await evalFnBodyAsPromise({
          context: new MetaesContext(),
          source: function () {
            (() => {
              throw 1;
            })();
          }
        });
      } catch (e) {
        assert.equal(e.type, "Error");
      }
    });

    it("should continue after try/catch block", async () => {
      assert.equal(
        await evalFnBodyAsPromise({
          context: new MetaesContext(),
          source: function () {
            try {
              (async () => {
                throw 1;
              })();
            } catch (e) {
              // ignore
            }
            "hello";
          }
        }),
        "hello"
      );
    });

    it("should catch any error in try statement", async () => {
      assert.instanceOf(
        await evalFnBodyAsPromise({
          context: new MetaesContext(),
          source: function () {
            let error;
            try {
              // @ts-ignore
              a;
            } catch (e) {
              error = e;
            }
            error;
          }
        }),
        ReferenceError
      );
    });
  });
});
