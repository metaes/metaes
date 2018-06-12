import { describe, it } from "mocha";
import { MetaesStore } from "../../lib/store";

import { expect } from "chai";

describe("MetaesStore", () => {
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
          expect(flameGraph.root.value).to.include("script");
          const Program = flameGraph.root.children[0];

          expect((Program.value as any).e.type).to.equal("Program");
          expect(Program.namedChildren).to.have.all.keys(["body"]);
        }

        if (!evaluation.tag.propertyKey && evaluation.e.type === "AssignmentExpression") {
          console.log(flameGraph.executionStack[flameGraph.executionStack.length - 1]);
        }
      }
    });

    await store.evaluate(store => {
      store["foo"] = "bar";
    });

    expect(store.getStore()["foo"]).to.equal("bar");
    expect(called).to.be.true;
  });
});
