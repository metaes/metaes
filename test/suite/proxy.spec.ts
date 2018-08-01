import { describe, it } from "mocha";
import { ContextProxy } from "../../lib/proxy";
import { expect } from "chai";

describe("Proxy", () => {
  it("should correctly build tree structure of children", async () => {
    const value = {};
    const proxy = new ContextProxy(value);
    await proxy.evaluate(() => (self["foo"] = "bar"));

    expect(value["foo"]).to.equal("bar");
  });

  it("should execute code inside proxied context", async () => {
    const value = {};
    const proxy = new ContextProxy(value);

    await proxy.evaluate(`self.foo="bar"`);

    expect(value["foo"]).to.equal("bar");
  });

  it("should collect trap results before value is set", async () => {
    const value = {};
    let called = false;
    const proxy = new ContextProxy(value, {
      set(proxyValue, key, args) {
        called = true;
        expect(proxyValue).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(proxyValue["foo"]).to.equal(undefined);
      }
    });
    const source = `self.foo="bar"`;
    await proxy.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results after value is set", async () => {
    const value = {};
    let called = false;
    const proxy = new ContextProxy(value, {
      didSet(proxyValue, key, args) {
        called = true;
        expect(proxyValue).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(proxyValue["foo"]).to.equal("bar");
      }
    });
    const source = `self["foo"]="bar"`;
    await proxy.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of dynamically added proxy", async () => {
    const source = `self["foo"]={}, self.foo.bar=1`;
    const value = {};
    let called = false;

    await new Promise((resolve, reject) => {
      const proxy = new ContextProxy(value, {
        didSet(_proxy, key) {
          proxy.addHandler({
            target: _proxy[key],
            traps: {
              set(_object, key, args) {
                try {
                  expect(key).to.equal("bar");
                  expect(args).to.equal(1);
                  called = true;
                  resolve();
                } catch (e) {
                  console.log({ _object, key, args });
                  reject(e);
                }
              }
            }
          });
        }
      });
      proxy.evaluate(source);
    });

    expect(called).to.be.true;
  });

  it("should collect trap results of method call", async () => {
    const value = [];
    let called = false;
    const proxy = new ContextProxy(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });
    await proxy.evaluate(`self.push(1)`);

    expect(called).to.be.true;
  });

  it("should collect trap results of chained method call", async () => {
    const value = { array: [] };
    let called = false;
    const proxy = new ContextProxy(value);
    proxy.addHandler({
      target: value.array,
      traps: {
        apply(target, methodName, args) {
          expect(target).to.equal(value.array);
          expect(methodName).to.equal(value.array.push);
          expect(args).to.eql([1]);
          called = true;
        }
      }
    });
    const source = `self.array.push(1)`;
    await proxy.evaluate(source);
    expect(value.array.length).to.equal(1);

    expect(called).to.be.true;
  });

  it("should collect trap results of method call when using apply", async () => {
    const value = [];
    let called = false;
    const proxy = new ContextProxy(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });

    await proxy.evaluate(`self.push.apply(self, [1])`);
    expect(value.length).to.equal(1);
    expect(called).to.be.true;
  });

  it("should collect trap results of method call when using call", async () => {
    const value = [];
    let called = false;
    const proxy = new ContextProxy(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });

    await proxy.evaluate(`self.push.call(self, 1)`);
    expect(value.length).to.equal(1);
    expect(called).to.be.true;
  });
});
