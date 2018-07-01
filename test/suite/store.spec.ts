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

  it("should collect trap results after value is set", async () => {
    const value = {};
    let called = false;
    const store = new MetaesStore(value, {
      didSet(store, key, args) {
        called = true;
        expect(store).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(store["foo"]).to.equal("foo");
      }
    });
    const source = `store["foo"]="bar"`;
    await store.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of dynamically added proxy", async () => {
    const value = {};
    let called = false;
    const store = new MetaesStore(value, {
      didSet(_store, key) {
        store.addProxy({
          target: _store[key],
          handler: {
            set(_object, key, args) {
              expect(key).to.equal("bar");
              expect(args).to.equal(1);
              called = true;
            }
          }
        });
      }
    });
    const source = `store["foo"]={}, store.foo.bar=1`;
    await store.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of method call", async () => {
    const value = [];
    let called = false;
    const store = new MetaesStore(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });
    const source = `store.push(1)`;
    await store.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of chained method call", async () => {
    const value = { array: [] };
    let called = false;
    const store = new MetaesStore(value);
    store.addProxy({
      target: value.array,
      handler: {
        apply(target, methodName, args) {
          expect(target).to.equal(value.array);
          expect(methodName).to.equal(value.array.push);
          expect(args).to.eql([1]);
          called = true;
        }
      }
    });
    const source = `store.array.push(1)`;
    await store.evaluate(source);
    expect(value.array.length).to.equal(1);

    expect(called).to.be.true;
  });
});
