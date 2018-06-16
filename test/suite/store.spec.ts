import { describe, it } from "mocha";
import { MetaesStore } from "../../lib/store";
import { expect } from "chai";

describe("MetaesStore", () => {
  it("should correctly build tree structure of children", async () => {
    const value = {};
    const store = new MetaesStore(value);
    await store.evaluate(store => (store["foo"] = "bar"));

    expect(value["foo"]).to.equal("bar");
  });

  it("should execute code inside store", async () => {
    const store = new MetaesStore({});
    await store.evaluate(`store["foo"]="bar"`);
    expect(store.getStore()["foo"]).to.equal("bar");
  });

  it("should collect trap results before value is set", async () => {
    const value = {};
    let called = false;
    const store = new MetaesStore(value, {
      set(store, key, args) {
        called = true;
        expect(store).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(store["foo"]).to.equal(undefined);
      }
    });
    const source = `store["foo"]="bar"`;
    await store.evaluate(source);

    expect(called).to.be.true;
  });
});
