import { describe, it } from "mocha";
import { metaesEval, evalFunctionBody, MetaesContext } from "./metaes";
import { callWithCurrentContinuation, getCurrentEnvironment } from "./special";
import { assert } from "chai";
import { Environment } from "./environment";

describe("Special", () => {
  it("should return current env", () => {
    function c(result: Environment) {
      assert.equal(result.values.answer, 42);
      assert.equal(result.values.getCurrentEnvironment, getCurrentEnvironment);
    }
    metaesEval(
      "var answer=42; getCurrentEnvironment()",
      c,
      e => {
        throw e;
      },
      { getCurrentEnvironment }
    );
  });

  it("should call with current continuation with additional arguments", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callWithCurrentContinuation, getCurrentEnvironment, receiver }
    });

    let env;
    function receiver(cc, environment) {
      // remember environment for later check
      env = environment;
      // intentionally continue a bit later
      setTimeout(cc, 0, 21);
    }

    const result = await evalFunctionBody(
      context,
      (callWithCurrentContinuation, getCurrentEnvironment) =>
        2 * callWithCurrentContinuation(receiver, getCurrentEnvironment())
    );
    assert.equal(result, 42);
    assert.containsAllKeys(env, ["values"]);
  });

  it("should continue after call/cc multiple times if user decides to", async () => {
    const result = [];
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc: callWithCurrentContinuation, receiver, result }
    });
    let cc;
    function receiver(_cc) {
      cc = _cc;
      cc([1, 2, 3]);
    }
    await evalFunctionBody(context, (callcc, result, receiver) => {
      for (let x of callcc(receiver)) {
        result.push(x);
      }
    });
    assert.deepEqual(result, [1, 2, 3]);
    cc([4, 5, 6]);
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6]);
  });
});
