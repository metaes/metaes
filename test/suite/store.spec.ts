import { describe, it } from "mocha";
import { MetaesStore } from "../../lib/store";

import { expect } from "chai";

describe("MetaesStore", () => {
  it("should execute code inside store", async () => {
    const store = new MetaesStore(
      {},
      {
        set: (store, key, value) => {
          console.log(key, value);
        }
      }
    );

    store.addTracker((evaluation, path) => {
      if (evaluation.e.type === "Program" && evaluation.tag.phase === "exit") {
        expect(path.root.evaluation).to.equal("_context");
        const Program = path.root.children[0];

        expect((Program.evaluation as any).e.type).to.equal("Program");
        expect(Program.namedChildren).to.have.all.keys(["body"]);
      }
    });

    await store.evaluate(store => {
      store["foo"] = "bar";
    });

    expect(store.getStore()["foo"]).to.equal("bar");
  });
});
