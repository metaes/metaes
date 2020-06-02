import { assert } from "chai";
import { before, beforeEach, describe, it } from "mocha";
import { GetProperty, SetProperty, Apply } from "../../lib/interpreter/base";
import { ECMAScriptInterpreters } from "../../lib/interpreters";
import { MetaesContext, evalFnBodyAsPromise } from "../../lib/metaes";

describe("Interpreters", () => {
  let context: MetaesContext;
  let me;

  before(() => {
    me = { firstName: "John", lastName: "Named" };
    let iterator = 1;
    let interpreters = {
      values: {
        GetProperty({ object }, c, _cerr) {
          if (object === me) {
            // Intentionally delay
            setTimeout(() => c(iterator++));
          } else {
            // make the `super` call
            GetProperty.apply(null, arguments);
          }
        }
      },
      prev: ECMAScriptInterpreters
    };
    context = new MetaesContext(undefined, console.error, { values: { me } }, { interpreters });
  });

  it("should support custom GetValue", async () => {
    assert.deepEqual(await evalFnBodyAsPromise({ context, source: me => [me.firstName, me.lastName] }), [1, 2]);
  });
});

describe("Example Proxy implementation", async () => {
  type Handler = {
    get?(target, name): any;
    set?(obj, prop, value): Boolean;
  };
  class Proxy {
    constructor(public target: any, public handler: Handler) {}
  }

  let interpreters = {
    values: {
      GetProperty({ object, property }, c) {
        if (object instanceof Proxy && object.handler.get) {
          c(object.handler.get(object.target, property));
        } else {
          GetProperty.apply(null, arguments);
        }
      },
      SetProperty({ object, property, value }, c, cerr) {
        if (object instanceof Proxy && object.handler.set) {
          try {
            c(object.handler.set(object.target, property, value));
          } catch (e) {
            cerr(e);
          }
        } else {
          SetProperty.apply(null, arguments);
        }
      }
    },
    prev: ECMAScriptInterpreters
  };

  const ERROR_MESSAGE = "Can't write to proxied object";
  let context: MetaesContext;

  beforeEach(() => {
    let value = { a: 1, b: 2 };
    let proxied = new Proxy(value, {
      get(object, property) {
        return object[property] + "mln";
      },
      set() {
        throw new Error(ERROR_MESSAGE);
      }
    });
    let self = { value, proxied };
    context = new MetaesContext(undefined, undefined, { values: { self, console } }, { interpreters });
  });

  it("should support standard get operations", async () => {
    assert.deepEqual(await evalFnBodyAsPromise({ context, source: self => [self.value.a, self.value.b] }), [
      1,
      2
    ]);
  });

  it("should support custom get operations", async () => {
    assert.deepEqual(await evalFnBodyAsPromise({ context, source: self => [self.proxied.a, self.proxied.b] }), [
      "1mln",
      "2mln"
    ]);
  });

  it("should support custom set operations", async () => {
    try {
      await context.evalFnBody(self => {
        self.proxied.a = "a new value";
      });
    } catch (e) {
      assert.equal(e.value.message, ERROR_MESSAGE);
    }
  });
});

describe("Example remote context for database access", () => {
  class MetaArray {
    constructor(private _internalArray: any[]) {}

    push(args, c, _cerr) {
      // a bit later
      setTimeout(() => {
        c(this._internalArray.push(...args));
      });
    }
    slice(args, c, _cerr) {
      c(this._internalArray.slice(args[0], args[1]));
    }

    length(c, _cerr) {
      c(10);
    }

    GetProperty({ property }, c, cerr) {
      if (property === "length") {
        this.length(c, cerr);
      } else if (typeof property === "number" && typeof this._internalArray[property] === "number") {
        c(this._internalArray[property] + "$");
      } else {
        c(this._internalArray[property]);
      }
    }
    SetProperty({ property, value }, c, cerr) {
      try {
        c((this._internalArray[property] = value));
      } catch (e) {
        cerr(e);
      }
    }
    Apply({ fn, args }, c, cerr) {
      if (fn.name === "push") {
        this.push(args, c, cerr);
      } else if (fn.name === "slice") {
        this.slice(args, c, cerr);
      } else {
        c(fn.apply(this._internalArray, args));
      }
    }
  }

  let interpreters = {
    values: {
      GetProperty({ object }) {
        if (object instanceof MetaArray) {
          object.GetProperty.apply(object, arguments);
        } else {
          GetProperty.apply(null, arguments);
        }
      },
      SetProperty({ object }) {
        if (object instanceof MetaArray) {
          object.SetProperty.apply(object, arguments);
        } else {
          SetProperty.apply(null, arguments);
        }
      },
      Apply({ thisValue }) {
        if (thisValue instanceof MetaArray) {
          thisValue.Apply.apply(thisValue, arguments);
        } else {
          Apply.apply(null, arguments);
        }
      }
    },
    prev: ECMAScriptInterpreters
  };

  let context: MetaesContext;

  beforeEach(() => {
    let self = {
      users: new MetaArray([])
    };
    context = new MetaesContext(undefined, console.error, { values: { self, console } }, { interpreters });
  });

  it("should support custom push method call", async () => {
    assert.deepEqual(
      await evalFnBodyAsPromise({
        context,
        source: self => {
          self.users.push({ name: "new user" });
          self.users[0];
        }
      }),
      { name: "new user" }
    );
  });

  it("should support custom slice method call", async () => {
    assert.deepEqual(
      await evalFnBodyAsPromise({
        context,
        source: self => {
          self.users.push({ name: "new user1" }, { name: "new user2" }, { name: "new user3" }, { name: "new user4" });
          self.users.slice(1, 3);
        }
      }),
      [{ name: "new user2" }, { name: "new user3" }]
    );
  });

  it("should support custom array length", async () => {
    assert.equal(await evalFnBodyAsPromise({ context, source: self => self.users.length }), 10);
  });

  it("should support assigning to and getting from number property", async () => {
    assert.equal(
      await evalFnBodyAsPromise({
        context,
        source: self => {
          self.users[0] = 1;
          self.users[0];
        }
      }),
      "1$"
    );
  });
});
