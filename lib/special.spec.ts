import { describe, it } from "mocha";
import { metaesEval, evalFunctionBody, MetaesContext } from "./metaes";
import { callWithCurrentContinuation, getCurrentEnvironment } from "./special";
import { assert } from "chai";

describe("Special", () => {
  it("should return current env", () => {
    function c(result) {
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

  it("should call with current continuation", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callWithCurrentContinuation, receiver, console }
    });

    function receiver(cc) {
      // intentionally continue a bit later
      setTimeout(cc, 0, 21);
    }
    const result = await evalFunctionBody(
      context,
      callWithCurrentContinuation => 2 * callWithCurrentContinuation(receiver)
    );
    assert.equal(result, 42);
  });
});
