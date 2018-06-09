import { describe, it } from "mocha";
import { assert } from "chai";
import { metaesEval } from "../../lib/metaes";

describe("Interceptor", () => {
  it("should be called specific amount of times", () => {
    let results: any[] = [];
    function onError(e) {
      console.log(e);
    }
    function interceptor(e) {
      results.push(e);
    }
    function noop() {}
    metaesEval("2", noop, noop, {}, { interceptor, onError });
    assert.equal(results.length, 10);
  });

  it.only("should pass values of MemberExpression", () => {
    let results: any[] = [];

    function onError(e) {
      console.log(e);
    }
    function interceptor(...args) {
      results.push([...args]);
    }
    function noop() {}
    const source = "a.b; a.c=2; a['d']=4;";
    metaesEval(source, noop, console.log, { a: { b: 2 }, console }, { interceptor, onError });

    let level = 0;
    results.forEach(([a, b, value]) => {
      if (a.phase === "exit") {
        level--;
      }
      const padding = "".padEnd(level, "  ");
      if (a.propertyKey) {
        console.log(padding, `(${a.phase === "exit" ? "/" : ""}${a.propertyKey})`);
      } else {
        console.log(padding, `"${source.substring(...b.range)}"`, b.type + ":", value);
      }

      if (a.phase === "enter") {
        level++;
      }
    });
  });
});
