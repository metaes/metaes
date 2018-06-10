import { describe, it } from "mocha";
import { assert, expect } from "chai";
import { metaesEval } from "../../lib/metaes";

describe("Interceptor", () => {
  function getEvaluationsOf(script: string, env) {
    let evaluations: any[] = [];

    function onError(e) {
      console.log(e);
    }
    function interceptor(...args) {
      evaluations.push([...args]);
    }

    function noop() {}
    metaesEval(script, noop, console.log, env, { interceptor, onError });
    return evaluations;
  }

  it("should be called specific amount of times", () => {
    assert.equal(getEvaluationsOf("2", {}).length, 10);
  });

  it("should pass values of MemberExpression", () => {
    expect(
      getEvaluationsOf("a.b", { a: { b: 2 } })
        .map(([a]) => a.propertyKey)
        .filter(Boolean)
    ).to.eql(["body", "expression", "object", "object", "property", "property", "expression", "body"]);

    expect(
      getEvaluationsOf("a.b", { a: { b: 2 } })
        .map(([a, b]) => a.propertyKey || b.type)
        .filter(Boolean)
    ).to.eql([
      "Program",
      "body",
      "ExpressionStatement",
      "expression",
      "MemberExpression",
      "object",
      "Identifier",
      "Identifier",
      "object",
      "property",
      "Identifier",
      "Identifier",
      "property",
      "MemberExpression",
      "expression",
      "ExpressionStatement",
      "body",
      "Program"
    ]);
    expect(
      getEvaluationsOf("a.b", { a: { b: 2 } })
        .map(([a, b, value]) => (value ? [a.propertyKey || b.type, value] : null))
        .filter(Boolean)
    ).to.eql([
      ["Identifier", { b: 2 }],
      ["Identifier", 2],
      ["MemberExpression", 2],
      ["ExpressionStatement", 2],
      ["Program", 2]
    ]);
    const source = "a.b; a.c=2; a['d']=4;";
    let results = getEvaluationsOf(source, { a: { b: 2 } });

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
