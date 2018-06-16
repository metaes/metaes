import { describe, it } from "mocha";
import { EvaluationNode, MetaesStore } from "../../lib/store";

import { expect } from "chai";
import { Evaluation } from "../../lib/types";

describe("MetaesStore", () => {
  it("should correctly build tree structure of children", async () => {
    const value = {};
    const store = new MetaesStore(value);
    await store.evaluate(store => (store["foo"] = "bar"));

    expect(value["foo"]).to.equal("bar");
  });

  it("should execute code inside store", async () => {
    const value = {};
    let called = false;
    const store = new MetaesStore(value, {
      set: (store, key, value) => {
        called = true;
        expect(store).to.equal(value);
        expect(key).to.equal("foo");
        expect(value).to.equal("bar");
      }
    });
    store.addListener((evaluation, flameGraph) => {
      if (evaluation.tag.phase === "exit") {
        if (evaluation.e.type === "Program") {
          const root = flameGraph.root;
          const Program = root.children[0];

          expect(root.evaluation).to.include("script");
          expect((Program.evaluation as Evaluation).e.type).to.equal("Program");
          expect(Program.namedChildren).to.have.all.keys(["body"]);
        }

        if (!evaluation.tag.propertyKey && evaluation.e.type === "AssignmentExpression") {
          // console.log(
          //   `!evaluation.tag.propertyKey && evaluation.e.type === "AssignmentExpression"`,
          //   flameGraph.executionStack
          // );
          const node = flameGraph.executionStack[flameGraph.executionStack.length - 1];

          console.log("l,r", node.namedChildren.left, node.namedChildren.right);

          function show(node: EvaluationNode, padding: number) {
            const paddingString = "".padEnd(padding, "  ");
            if (typeof node.evaluation === "object") {
              console.log(paddingString, node.evaluation.e.type);
            } else {
              console.log(paddingString, node.evaluation);
            }

            Object.entries(node.namedChildren).forEach(([k, v]) => {
              if (Array.isArray(v)) {
                v.forEach(node => show(node, padding + 1));
              } else {
                show(v, padding + 1);
              }
            });
          }

          show(flameGraph.root.children[0], 0);
        }
      }
    });

    await store.evaluate(`store["foo"]="bar"`);

    expect(store.getStore()["foo"]).to.equal("bar");
    //expect(called).to.be.true;
  });
});
