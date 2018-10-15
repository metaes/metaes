import { assert } from "chai";
import { before, beforeEach, describe, it } from "mocha";
import { GetProperty, SetProperty } from "./interpreter/base";
import { EcmaScriptInterpreters } from "./interpreters";
import { MetaesContext } from "./metaes";
import { createReadStream } from "fs";

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
      prev: EcmaScriptInterpreters
    };
    context = new MetaesContext(undefined, console.error, { values: { me } }, { interpreters });
  });

  it("should support custom GetValue", async () => {
    assert.deepEqual(await context.evalFunctionBody(me => [me.firstName, me.lastName]), [1, 2]);
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
    prev: EcmaScriptInterpreters
  };

  const ERROR_MESSAGE = "Can't write to proxied object";
  let value, self, context;

  beforeEach(() => {
    value = { a: 1, b: 2 };
    let proxied = new Proxy(value, {
      get(object, property) {
        return object[property] + "mln";
      },
      set() {
        throw new Error(ERROR_MESSAGE);
      }
    });
    self = { value, proxied };
    context = new MetaesContext(undefined, console.error, { values: { self, console } }, { interpreters });
  });

  it("should standard get operations", async () => {
    assert.deepEqual(await context.evalFunctionBody(() => [self.value.a, self.value.b]), [1, 2]);
  });
  it("should support custom get operations", async () => {
    assert.deepEqual(await context.evalFunctionBody(() => [self.proxied.a, self.proxied.b]), ["1mln", "2mln"]);
  });
  it("should support custom set operations", async () => {
    try {
      await context.evalFunctionBody(() => {
        self.proxied.a = "a new value";
      });
    } catch (e) {
      assert.equal(e.value.message, ERROR_MESSAGE);
    }
  });
});

describe("Example remote context for database access", () => {
  class Table {
    constructor(public name: string) {}

    GetProperty();
  }
  let env = {
    posts: new Table("posts"),
    users: new Table("users")
  };
});
