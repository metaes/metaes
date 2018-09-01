import { describe, it } from "mocha";
import { evalFunctionBody, MetaesContext, metaesEval, evalToPromise } from "./metaes";
import { assert } from "chai";

describe("Exceptions", () => {
  it("should throw on AwaitExpression use", () =>
    new Promise(resolve => {
      metaesEval(
        `(async ()=>await 2)()`,
        x => {
          console.log({ x });
        },
        resolve
      );
    }));

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
      assert.equal(
        await evalFunctionBody(new MetaesContext(), function() {
          try {
            (async () => {
              throw 1;
            })();
          } catch (e) {
            // ignore
          }
          "hello";
        }),
        "hello"
      );
    });

    it("should catch any error in try statement", async () => {
      // declare variable to stop TypeScript warnings
      let a;

      assert.isTrue(
        (await evalFunctionBody(new MetaesContext(), function() {
          let error;
          try {
            a; //
          } catch (e) {
            error = e;
          }
          error;
        })) instanceof ReferenceError
      );
    });

    it("should merge two or more environments", async () => {
      const ctx = new MetaesContext(undefined, undefined, { values: { a: 1 } });
      assert.equal(await evalToPromise(ctx, "a"), 1, "doesn't work with basic environment");
      assert.equal(await evalToPromise(ctx, "a", { values: { a: 2 } }), 2, "doesn't work with variable shadowing");

      assert.deepEqual(
        await evalToPromise(ctx, "[a,b]", { values: { b: 1 } }),
        [1, 1],
        "doesn't work with creating inner scope"
      );
      const env1 = { values: { b: 2 } };
      const env2 = { values: { c: 3 }, prev: env1 };

      assert.deepEqual(
        await evalToPromise(ctx, "[a,b,c]", env2),
        [1, 2, 3],
        "doesn't work with creating inner scope with double scope environment"
      );
    });
  });
});
