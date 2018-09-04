import { describe, it } from "mocha";
import { ObservableContext, createListenerToCollectObservables } from "./observable";
import { expect } from "chai";
import { evaluateFunction, evalToPromise } from "./metaes";
import { zip } from "lodash";

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

  it("should collect only observable variables", async () => {
    const self = {
      user: { name: "First", lastname: "Lastname", address: { street: "Long" } }
    };
    const context = new ObservableContext(self);
    const task = { name: "test" };
    const environment = {
      values: { nonObservableThing: { empty: true }, task },
      tags: { task: { observable: true } },
      prev: context.environment
    };
    const results: any[] = [];
    context.addListener(createListenerToCollectObservables(result => results.push(result), environment));

    const sources = [
      "task.name",
      "task['name']", // test computed property
      "self.user.address",
      "self.user",
      "self.user.address.street",
      "self",
      "nonObservableThing.value1"
    ];
    const expected = [
      { object: task, property: "name" },
      { object: task, property: "name" },
      { object: self.user, property: "address" },
      { object: self, property: "user" },
      { object: self.user.address, property: "street" },
      { object: self },
      null
    ];

    for (const [source, expectedValue] of zip(sources, expected)) {
      results.length = 0;
      await evalToPromise(context, source, environment);
      if (expectedValue) {
        expect(results.length).to.equal(1);
        expect(results[0]).deep.equal(expectedValue);
      }
    }
  });
});
