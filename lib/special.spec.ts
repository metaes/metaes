import { assert, expect } from "chai";
import { describe, it } from "mocha";
import { Environment } from "./environment";
import { evalFunctionBody, evaluateFunction, MetaesContext, metaesEval } from "./metaes";
import { callWithCurrentContinuation, getCurrentEnvironment } from "./special";
import { isMetaFunction, evaluateMetaFunction, getMetaFunction } from "./metafunction";

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
    function receiver(_cc, _cerr, value) {
      cc = _cc;
      cc(value);
    }
    await evalFunctionBody(context, (callcc, result, receiver) => {
      const bind = value => callcc(receiver, value);
      for (let x of bind([1, 2, 3])) {
        result.push(x);
      }
    });
    assert.deepEqual(result, [1, 2, 3]);
    // rerun loop
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
        callcc(function(cc) {
          evilGoTo = cc;
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

  it("should support custom yield expression", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc: callWithCurrentContinuation, console, isMetaFunction, getMetaFunction, evaluateMetaFunction }
    });

    const result = await evalFunctionBody(context, (callcc, isMetaFunction, evaluateMetaFunction, getMetaFunction) => {
      function receiver(cc, ccerr, value) {
        ccerr({ type: "NextIteration", value: { value, cc } });
      }

      function getIterator(fn) {
        if (!isMetaFunction(fn)) {
          throw "Creating iterator from native function not supported yet";
        }
        let continuation;
        let value;
        let done = false;
        function start() {
          evaluateMetaFunction(
            getMetaFunction(fn),
            () => {
              done = true;
            },
            e => {
              value = e.value.value;
              continuation = e.value.cc;
            },
            null,
            []
          );
        }

        return {
          next() {
            if (done) {
              return { value: void 0, done: true };
            }
            if (continuation) {
              continuation();
            } else {
              start();
            }
            if (done) {
              return this.next();
            }
            return { value, done };
          }
        };
      }
      const yield_ = value => callcc(receiver, value);

      function generatorLikeFunction() {
        for (let i of [1, 2, 3]) {
          yield_(i);
        }
        yield_("another one");
      }
      const iterator = getIterator(generatorLikeFunction);
      const results: any[] = [];

      results.push(iterator.next());
      results.push(iterator.next());
      results.push(iterator.next());
      results.push(iterator.next());
      results.push(iterator.next());

      results;
    });

    expect(result).deep.eq([
      { value: 1, done: false },
      { value: 2, done: false },
      { value: 3, done: false },
      { value: "another one", done: false },
      { value: undefined, done: true }
    ]);
  });
});
