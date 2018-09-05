import { assert, expect } from "chai";
import { describe, it } from "mocha";
import { Environment } from "./environment";
import { evalFunctionBody, evaluateFunction, MetaesContext, metaesEval } from "./metaes";
import { callWithCurrentContinuation, getCurrentEnvironment } from "./special";

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
    function receiver(cc, _cerr, environment) {
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

  it(`should continue after call/cc multiple times if user decides to. 
      Should execut first time using passed in value`, async () => {
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
      function bind(receiver) {
        return callcc(receiver);
      }
      for (let x of bind(receiver)) {
        result.push(x);
      }
    });
    assert.deepEqual(result, [1, 2, 3]);
    cc([4, 5, 6]);
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6]);
  });

  it("should accept metaes function as call/cc receiver", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc: callWithCurrentContinuation, console }
    });

    const i = await evaluateFunction(
      context,
      callcc => {
        let evilGoTo;
        let i = 0;
        callcc(function(_cc) {
          evilGoTo = _cc;
          evilGoTo();
        });
        i++;
        if (i < 10) {
          evilGoTo();
        }
        return i;
      },
      callWithCurrentContinuation
    );

    assert.equal(i, 10);
  });

  it("should throw from call/cc receiver", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc: callWithCurrentContinuation, console }
    });

    function receiver(_cc, cerr) {
      cerr({ value: new Error("Continuation error") });
    }

    const error = await evaluateFunction(
      context,
      (callcc, receiver) => {
        try {
          callcc(receiver);
        } catch (e) {
          return e;
        }
      },
      callWithCurrentContinuation,
      receiver
    );
    expect(error.message).equal("Continuation error");
  });
});
