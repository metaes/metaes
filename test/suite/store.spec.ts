import { describe, it } from "mocha";
import { MetaesStore } from "../../lib/store";

import { expect } from "chai";

describe("MetaesStore", () => {
  it("should execute code inside store", async () => {
    const store = new MetaesStore({});

    store.addTracker((evaluation, path) => {
      if (evaluation.e.type === "Program" && evaluation.tag.phase === "exit") {
        console.log(JSON.stringify(path.root, null, 2));
      }
    });

    await store.evaluate(store => {
      store["foo"] = "bar";
    });

    expect(store.getStore()["foo"]).to.equal("bar");
  });
});
