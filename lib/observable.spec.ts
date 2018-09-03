import { describe, it } from "mocha";
import { ObservableContext } from "./observable";
import { expect } from "chai";
import { evaluateFunction } from "./metaes";

describe("ObservableContext", () => {
  it("should correctly build tree structure of children", async () => {
    const value = {};
    const context = new ObservableContext(value);

    await evaluateFunction(context, () => (self["foo"] = "bar"));

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
        called = true;
        expect(observedValue).to.equal(value);

        expect(key).to.equal("foo");
        expect(args).to.equal("bar");

        expect(observedValue["foo"]).to.equal(undefined);
      }
    });
    const source = `self.foo="bar"`;
    await context.evaluate(source);

    expect(called).to.be.true;
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

  it("should collect results of member expressions", async () => {
    const self = {
      user: { name: "First", lastname: "Lastname", address: { street: "Long" } }
    };
    const context = new ObservableContext(self);
    const source = `[self.user.address, self.user, self.user.address.street, dummy.value1]`;
    const bottomEnv = { values: { dummy: { dummyEmpty: true } }, prev: context.environment };
    const actualToObserve = await context.getObjectsToObserve(source, bottomEnv);
    const results = [...actualToObserve];
    const expected = [self.user, self, self.user.address];

    console.log({ results });

    results.forEach(result => expect(expected).to.include(result));
    expect(results).to.have.length(expected.length);
  });
});
