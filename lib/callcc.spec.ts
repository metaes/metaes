import { assert, expect } from "chai";
import { describe, it } from "mocha";
import { callcc, lifted, liftedAll } from "./callcc";
import { Apply } from "./interpreter/base";
import { evalFnAsPromise, evalFnBodyAsPromise, MetaesContext, metaesEval } from "./metaes";
import { evaluateMetaFunction, getMetaFunction, isMetaFunction } from "./metafunction";
import { defaultScheduler } from "./evaluate";

describe("Callcc", () => {
  it("should return current env", () => {
    function receiver(_, _c, _cerr, env) {
      assert.equal(env.values.answer, 42);
      assert.equal(env.values.callcc, callcc);
    }
    metaesEval(
      "var answer=42; callcc(receiver)",
      console.log,
      e => {
        throw e;
      },
      { callcc, receiver }
    );
  });

  it("should call with current continuation with additional arguments", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc, receiver }
    });

    let env;
    function receiver(_, cc, _cerr, environment) {
      // remember environment for later check
      env = environment;
      // intentionally continue a bit later
      setTimeout(cc, 0, 21);
    }

    const result = await evalFnBodyAsPromise({
      context,
      source: callcc => 2 * callcc(receiver)
    });
    assert.equal(result, 42);
    assert.containsAllKeys(env, ["values"]);
  });

  it("should continue after call/cc multiple times if user decides to", async () => {
    const result = [];
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc, receiver, result }
    });
    let cc;
    function receiver(_, _cc) {
      cc = _cc;
      cc([1, 2, 3]);
    }
    await evalFnBodyAsPromise({
      context,
      source: (callcc, result, receiver) => {
        for (let x of callcc(receiver)) {
          result.push(x);
        }
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
      values: { callcc, receiver, result }
    });
    let cc;
    function receiver(value, _cc, _cerr) {
      cc = _cc;
      cc(value);
    }
    await evalFnBodyAsPromise({
      context,
      source: (callcc, result, receiver) => {
        const bind = value => callcc(receiver, value);
        for (let x of bind([1, 2, 3])) {
          result.push(x);
        }
      }
    });
    assert.deepEqual(result, [1, 2, 3]);
    // rerun loop
    cc([4, 5, 6]);
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6]);
  });

  it("should accept metaes function as call/cc receiver", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc, console }
    });

    const i = await evalFnAsPromise({
      context,
      source: callcc => {
        let evilGoTo;
        let i = 0;

        callcc(function(_, cc) {
          evilGoTo = cc;
          evilGoTo();
        });
        i++;
        if (i < 10) {
          evilGoTo();
        }
        return i;
      },
      args: [callcc]
    });
    assert.equal(i, 10);
  });

  it("should throw from call/cc receiver", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc, console }
    });

    function receiver(_, _cc, cerr) {
      cerr({ value: new Error("Continuation error") });
    }

    const error = await evalFnAsPromise({
      context,
      source: (callcc, receiver) => {
        try {
          callcc(receiver);
        } catch (e) {
          return e;
        }
      },
      args: [callcc, receiver]
    });
    expect(error.message).equal("Continuation error");
  });

  it("should support custom yield expression", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: { callcc, console, isMetaFunction, Apply }
    });

    const result = await evalFnBodyAsPromise({
      context,
      source: (callcc, isMetaFunction, Apply) => {
        function receiver(value, cc, ccerr) {
          ccerr({ type: "NextIteration", value: { value, cc } });
        }
        function getIterator(fn) {
          if (!isMetaFunction(fn)) {
            throw "Creating iterator from native function not supported yet";
          }
          let continuation;
          let value;
          let done = false;
          let error;
          function start() {
            Apply(
              { fn, args: [] },
              () => {
                done = true;
              },
              e => {
                if (e.type === "NextIteration") {
                  value = e.value.value;
                  continuation = e.value.cc;
                } else {
                  error = e.value;
                }
              }
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
              if (error) {
                throw error;
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
      }
    });
    expect(result).deep.eq([
      { value: 1, done: false },
      { value: 2, done: false },
      { value: 3, done: false },
      { value: "another one", done: false },
      { value: undefined, done: true }
    ]);
  });

  it("should allow to simulate await", async () => {
    const context = new MetaesContext(undefined, undefined, {
      values: {
        awaitReceiver_,
        callcc,
        console,
        isMetaFunction,
        getMetaFunction,
        evaluateMetaFunction
      }
    });

    function awaitReceiver_(value, cc, cerr) {
      if (value instanceof Promise) {
        value.then(cc).catch(e => cerr({ value: e }));
      } else {
        cc(value);
      }
    }

    const serverData = { "fake-server-data": ["hello", "world"] };
    const errorMessage = "Can't load data";

    const result = await evalFnBodyAsPromise(
      {
        context,
        source: (awaitReceiver_, callcc, loadData, loadFailingData) => {
          const await_ = (target?) => callcc(awaitReceiver_, target);

          const results: any[] = [];
          try {
            await_(loadFailingData());
          } catch (e) {
            results.push(e.message);
          }
          results.concat([await_(1), 5, await_(loadData())]);
        }
      },
      {
        values: {
          loadFailingData: () => new Promise((_, reject) => setTimeout(reject, 0, new Error(errorMessage))),
          loadData: () => new Promise(resolve => setTimeout(resolve, 10, serverData))
        }
      }
    );
    expect(result).deep.eq([errorMessage, 1, 5, serverData]);
  });

  it("should lift functions", async () => {
    function socket(int, c) {
      for (let i = 0; i < 6; i++) {
        c(int + ":" + i);
      }
    }

    function pack(amount) {
      let group: any = [];
      return lifted((val, c) => {
        group.push(val);
        if (group.length === amount) {
          c([group]);
          group = [];
        }
      });
    }

    const context = new MetaesContext(
      undefined,
      console.error,
      {
        values: Object.assign({ console, pack, setTimeout, assert }, liftedAll({ socket }))
      },
      { schedule: defaultScheduler }
    );
    await evalFnBodyAsPromise({
      context,
      source: assert => {
        const pack3 = pack(3);
        const pack2 = pack(2);
        // @ts-ignore
        assert.deepEqual(pack2(pack3(socket(80))), [[[["80:0", "80:1", "80:2"]], [["80:3", "80:4", "80:5"]]]]);
      }
    });
  });
});
