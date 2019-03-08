import { expect } from "chai";
import { describe, it } from "mocha";
import { evalFn } from "./metaes";
import { ObservableContext } from "./observable";

describe("ObservableContext", () => {
  it("should correctly build tree structure of children", async () => {
    const value = {};
    const context = new ObservableContext(value);

    await evalFn({ context, source: () => (self["foo"] = "bar") });

    expect(value["foo"]).to.equal("bar");
  });

  it("should execute code inside proxied context", async () => {
    const value = {};
    const context = new ObservableContext(value);

    await context.evaluate(`self.foo="bar"`);

    expect(value["foo"]).to.equal("bar");
  });

  it("should collect trap results before value is set", async () => {
    const value = {};
    let called = false;
    const context = new ObservableContext(value, {
      set(observedValue, key, args) {
        expect(observedValue).to.equal(value);
        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(observedValue["foo"]).to.equal(undefined);

        called = true;
      }
    });
    const source = `self.foo="bar"`;
    await context.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of assignment expression in global scope", async () => {
    const value = { foo: false };
    const results: any[] = [];
    const context = new ObservableContext(value, {
      didSet() {
        results.push([...arguments]);
      }
    });
    const source = `foo=true`;
    await context.evaluate(source);

    expect(results[0]).to.deep.equal([value, "foo", true]);
  });

  it("should not collect trap results of assignment expression in local scope", async () => {
    const value = { foo: false };
    const results: any[] = [];
    const context = new ObservableContext(value, {
      didSet() {
        results.push([...arguments]);
      }
    });
    const source = `(()=>{var foo; foo="value"})()`;
    await context.evaluate(source);

    // Local foo was not observed
    expect(results.length).to.equal(0);
  });

  it("should collect trap results before value is set with computed expression", async () => {
    const value = {};
    let called = false;
    const context = new ObservableContext(value, {
      set(observedValue, key, args) {
        expect(observedValue).to.equal(value);
        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(observedValue["foo"]).to.equal(undefined);

        called = true;
      }
    });
    const source = `self['foo']="bar"`;
    await context.evaluate(source);

    expect(called).to.be.true;
  });

  it("should call trap exactly once using mainHandler", async () => {
    const value = {};
    let counter = 0;
    const context = new ObservableContext(value, {
      set(observed, key) {
        if (observed === value && key === "foo") {
          counter++;
        }
      }
    });
    const source = `self.foo="bar"`;
    await context.evaluate(source);
    expect(counter).equal(1);
  });

  it("should call trap exactly once using custom handler", async () => {
    const value = { toObserve: {} };
    let counter = 0;
    const context = new ObservableContext(value);
    context.addHandler({
      target: value.toObserve,
      traps: {
        set(observed, key) {
          if (observed === value.toObserve && key === "foo") {
            counter++;
          }
        }
      }
    });
    const source = `self.toObserve.foo="bar"`;
    await context.evaluate(source);
    expect(counter).equal(1);
  });

  it("should collect trap results after value is set", async () => {
    const value = {};
    let called = false;
    const context = new ObservableContext(value, {
      didSet(observedValue, key, args) {
        called = true;
        expect(observedValue).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(observedValue["foo"]).to.equal("bar");
      }
    });
    const source = `self["foo"]="bar"`;
    await context.evaluate(source);

    expect(called).to.be.true;
  });

  it("should collect trap results of dynamically added context", async () => {
    const source = `self["foo"]={}, self.foo.bar=1`;
    const value = {};
    let called = false;

    await new Promise((resolve, reject) => {
      const context = new ObservableContext(value, {
        didSet(_context, key) {
          context.addHandler({
            target: _context[key],
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
      context.evaluate(source);
    });

    expect(called).to.be.true;
  });

  it("should collect trap results of method call", async () => {
    const value = [];
    let called = false;
    const context = new ObservableContext(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });
    await context.evaluate(`self.push(1)`);

    expect(called).to.be.true;
  });

  it("should collect trap results of method call with computed property", async () => {
    const value = [];
    let called = false;
    const context = new ObservableContext(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });
    await context.evaluate(`self['push'](1)`);

    expect(called).to.be.true;
  });

  it("should collect trap results of method call with computed property with identifier", async () => {
    const value = [];
    let called = false;
    const context = new ObservableContext(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });
    await context.evaluate(`let method='pu'+'sh'; self[method](1)`);

    expect(called).to.be.true;
  });

  it("should collect trap results of chained method call", async () => {
    const value = { array: [] };
    let called = false;
    const context = new ObservableContext(value);
    context.addHandler({
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
    await context.evaluate(source);
    expect(value.array.length).to.equal(1);

    expect(called).to.be.true;
  });

  it("should collect trap results of method call when using apply", async () => {
    const value = [];
    let called = false;
    const context = new ObservableContext(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });

    await context.evaluate(`self.push.apply(self, [1])`);
    expect(value.length).to.equal(1);
    expect(called).to.be.true;
  });

  it("should collect trap results of method call when using call", async () => {
    const value = [];
    let called = false;
    const context = new ObservableContext(value, {
      apply(target, methodName, args) {
        expect(target).to.equal(value);
        expect(methodName).to.equal(value.push);
        expect(args).to.eql([1]);
        called = true;
      }
    });

    await context.evaluate(`self.push.call(self, 1)`);
    expect(value.length).to.equal(1);
    expect(called).to.be.true;
  });
});
