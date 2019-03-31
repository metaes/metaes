import { describe, it } from "mocha";
import { evalFnBodyAsPromise, MetaesContext } from "../../lib/metaes";
import { callcc } from "../../lib/callcc";

describe("Do not track", () => {
  // TODO: test TypeError
  it.skip("should support ObjectPattern", async () => {
    function getEnv(_, c, _cerr, env) {
      c(env.values);
    }
    const context = new MetaesContext(undefined, undefined, {
      values: {
        console,
        getEnv,
        callcc
      }
    });
    const source = () => {
      let { a, b = 3, c = 4 } = { a: 1, b: 2 };
      console.log("done, env:", callcc(getEnv));
      a == 1 && b === 2 && c === 4;

      // let called = false;
      // function foo() {
      //   called = true;
      //   return 4;
      // }
      // let {
      //   a,
      //   b: { c = foo() }
      // } = { a: 1, b: { c: 2 } };

      // a == 1 && c === 2 && called === false;
    };

    const r = await evalFnBodyAsPromise({
      context,
      source
    });
    console.log(r);
  });
  // TODO: test TypeError
  it.skip("should support ObjectPattern", async () => {
    function getEnv(_, c, _cerr, env) {
      c(env.values);
    }
    const callcc = callcc;
    const context = new MetaesContext(undefined, undefined, {
      values: {
        console,
        getEnv,
        callcc
      }
    });
    const source = () => {
      try {
        // @ts-ignore
        let { [key]: foo } = { z: "bar" };
      } catch (e) {
        console.log(e);
      }
      console.log(callcc(getEnv));
    };
    console.log(source.toString());
    const r = await evalFnBodyAsPromise({
      context,
      source
    });
    console.log(r);
  });
});
