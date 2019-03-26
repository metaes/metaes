require("source-map-support").install();

import { assert } from "chai";
import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import * as NodeTypes from "../lib/nodeTypes";
import { Environment } from "./environment";
import { Apply, GetProperty, Identifier, SetProperty } from "./interpreter/base";
import { ECMAScriptInterpreters } from "./interpreters";
import {
  consoleLoggingMetaesContext,
  Context,
  evalAsPromise,
  evalFnBody,
  evalFnBodyAsPromise,
  MetaesContext
} from "./metaes";
import {
  createHTTPConnector,
  createWSConnector,
  environmentFromMessage,
  environmentToMessage,
  getReferencesMap,
  mergeValues,
  RemoteObject
} from "./remote";
import { runWSServer } from "./server";

const W3CWebSocket = require("websocket").w3cwebsocket;

describe("Environment operations", () => {
  let context: Context;
  let context2: Context;

  beforeEach(() => {
    context = consoleLoggingMetaesContext();
    context2 = consoleLoggingMetaesContext();
  });

  it("should properly serialize/deserialize primitive values in enviromnent", () => {
    const primitiveValues = { foo: "bar", a: 1, b: false };
    assert.deepEqual(environmentToMessage(context, { values: primitiveValues }), { values: primitiveValues });
  });

  it("should properly serialize/deserialize object values in enviromnent", () => {
    function fn() {}
    const obj = { fn };
    const env: Environment = { values: { fn, obj } };
    const json = environmentToMessage(context, env);
    const envBack = environmentFromMessage(context, json);
    assert.deepEqual(env, envBack);
  });

  it("should properly serialize/deserialize object values in enviromnent with multiple contexts", () => {
    [context, context2].forEach(context => {
      function fn() {}
      const obj = { fn };
      const env: Environment = { values: { fn, obj } };
      const json = environmentToMessage(context, env);
      assert.equal(getReferencesMap(context).size, 2);
      const envBack = environmentFromMessage(context, json);
      assert.deepEqual(env, envBack);
      assert.equal(getReferencesMap(context).size, 2);
    });
  });

  it("should properly add values to existing environment", () => {
    const env = { values: { a: 1 } };
    const env2 = mergeValues({ b: 2 }, env);

    assert.equal(env2.values["a"], 1);
  });
});

describe("Remote", () => {
  let server;

  before(async () => {
    server = await runWSServer();
  });

  after(() => server.close());

  createTestsFor("Remote HTTP messaging", () => createHTTPConnector("http://localhost:" + server.address().port));
  createTestsFor("Remote WebSocket messaging", () =>
    createWSConnector(W3CWebSocket)(`ws://localhost:` + server.address().port)
  );
});

function createTestsFor(describeName: string, getContext: () => Promise<Context> | Context) {
  describe(describeName, () => {
    describe("Bound contexts", () => {
      let context;
      before(
        async () =>
          (context = new MetaesContext(
            undefined,
            undefined,
            { values: {} },
            {
              interpreters: getBindingInterpretersFor(await getContext())
            }
          ))
      );
      after(() => context.close && context.close());
    });
    describe("Basic contexts", () => {
      let context;
      before(async () => (context = await getContext()));
      after(() => context.close && context.close());

      it("should correctly deliver primitive success value", async () =>
        assert.equal(4, await evalAsPromise(context, "2+2")));

      it("should correctly deliver primitive success value in multiple simultaneous contexts", async () => {
        assert.equal(4, await evalAsPromise(context, "2+2"));
        assert.equal(2, await evalAsPromise(context, "1+1"));
      });

      it("should correctly deliver primitive success value using environment in multiple simultaneous contexts", async () => {
        assert.equal(4, await evalAsPromise(context, "a+b", { values: { a: 1, b: 3 } }));
        assert.equal(2, await evalAsPromise(context, "a-b", { values: { a: 4, b: 2 } }));
      });

      it("should correctly deliver primitive success value using continuation", () =>
        new Promise((resolve, reject) => {
          context.evaluate("2+2", value => {
            try {
              assert.equal(value, 4);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }));

      it("should not throw when c and cerr are not defined and result is correct", () => context.evaluate("2+2"));

      it("should not throw when cerr is not defined, evaluation is synchronous and result is incorrect", async () =>
        context.evaluate("throw 1;"));

      it("should correctly deliver primitive success value and use env", async () =>
        assert.equal(4, await evalAsPromise(context, "2+a", { values: { a: 2 } })));

      it("should correctly deliver non-primitve success value and use env", async () => {
        let value = [1, 2, 3];
        assert.equal(
          value.toString(),
          (await evalAsPromise(context, "a", {
            values: { a: [1, 2, 3] }
          })).toString()
        );
      });

      it("should return correct value reading a disk file", async () => {
        const command = "cat tsconfig.json";

        assert.equal(
          require("child_process")
            .execSync(command)
            .toString(),
          await evalFnBodyAsPromise(
            { context, source: (child_process, command) => child_process.execSync(command).toString() },
            {
              values: { command: command }
            }
          )
        );
      });

      it("should throw an exception", async () => {
        let thrown = false;
        try {
          await evalFnBody(context, () => window); // window is undefined on nodejs
        } catch (e) {
          if (e) {
            thrown = true;
          }
        }
        assert.equal(true, thrown);
      });
    });
  });
}

describe("Raw HTTP calls", () => {
  let server, url;

  before(async () => {
    server = await runWSServer();
    url = `http://localhost:` + server.address().port;
  });

  after(() => server.close());

  it("should return response using string query", async () => {
    assert.equal(await fetch(url, { method: "post", body: "2+2" }).then(d => d.text()), "4");
  });

  it("should throw when using string query", async () => {
    const { json, status } = await fetch(url, { method: "post", body: "throw 1" }).then(async response => ({
      json: await response.json(),
      status: response.status
    }));
    assert.equal(json.type, "ThrowStatement");
    assert.equal(status, 400);
  });

  it("should throw and return error message using string query", async () => {
    const { json, status } = await fetch(url, { method: "post", body: `foo;` }).then(async response => ({
      json: await response.json(),
      status: response.status
    }));
    assert.equal(json.type, "ReferenceError");
    assert.equal(json.value.message, '"foo" is not defined.');
    assert.equal(status, 400);
  });

  it("should return response using object", async () => {
    const response = await fetch(url, {
      method: "post",
      body: JSON.stringify({ input: "2+2" }),
      headers: { "content-type": "application/json" }
    }).then(d => d.json());

    assert.deepEqual(response, 4);
  });

  it("should throw when using JSON query", async () => {
    const { json, status } = await fetch(url, {
      method: "post",
      body: JSON.stringify({ input: "throw 1" }),
      headers: { "content-type": "application/json" }
    }).then(async response => ({
      json: await response.json(),
      status: response.status
    }));
    assert.equal(json.type, "ThrowStatement");
    assert.equal(status, 400);
  });
});

describe("Remote objects", () => {
  const getOtherContext = () =>
    new MetaesContext(undefined, console.error, {
      values: {
        stringMessage: "Hello",
        objectMessage: { value: "Hello" },
        valuesContainer: { i: 0 },
        storage: {
          addFile(contents, name) {
            return `${name}: "${contents}" was saved.`;
          }
        }
      }
    });
  describe("In other local context", () => {
    createRemoteContextTestsFor(() => getOtherContext());
  });

  // describe("In behind-network context", () => {
  //   let server;

  //   before(async () => {
  //     server = await runWSServer(undefined, getOtherContext());
  //   });

  //   after(() => server.close());

  //   // describe("HTTP", () =>
  //   //   createRemoteContextTestsFor(() => createHTTPConnector("http://localhost:" + server.address().port)));
  //   describe("WebSockets", () =>
  //     createRemoteContextTestsFor(() => createWSConnector(W3CWebSocket)(`ws://localhost:` + server.address().port)));
  // });
});

function createRemoteContextTestsFor(getContext: () => Promise<Context> | Context) {
  let localContext: MetaesContext, _eval;

  before(async () => {
    localContext = new MetaesContext(
      undefined,
      console.error,
      { values: {} },
      {
        interpreters: getBindingInterpretersFor(await getContext())
      }
    );
    _eval = async (script, env?) => {
      try {
        return await localContext.evalAsPromise(script, env);
      } catch (e) {
        throw e.value || e;
      }
    };
  });

  it("should query remote primitive value from different context", async () => {
    assert.equal("Hello", await _eval("stringMessage"));
  });

  it("should query object value from different context", async () => {
    assert.isTrue(
      (await _eval("objectMessage")) instanceof RemoteObject,
      "object is transferred as a RemoteObject reference"
    );
    assert.equal(
      await _eval(`let world=" world!"; objectMessage.value+world`),
      "Hello world!",
      "remote object property access is executed on remote context"
    );
  });

  it("should call remote method with local arguments", async () => {
    assert.equal(
      await _eval(`let extension="txt"; storage.addFile(contents, "test" + "." + extension);`, {
        values: { contents: "File contents" }
      }),
      'test.txt: "File contents" was saved.'
    );
  });

  it("should set property on remote object", async () => {
    assert.equal(await _eval(`valuesContainer.i = 44; valuesContainer.i`), 44);
  });
}

describe("Remote references", () => {
  let serverContext: Context, _eval, server;
  before(async () => {
    const me = {
      firstName: "User1",
      lastName: "Surname1",
      setOnlineStatus(_flag) {},
      logout() {}
    };
    server = await runWSServer(
      undefined,
      new MetaesContext(undefined, console.error, {
        values: {
          me,
          posts: [
            {
              title: "Post1",
              body: "Body of post1",
              likedBy: [me]
            },
            {
              title: "Post2",
              body: "Body of post2",
              likedBy: [me]
            }
          ]
        }
      })
    );
    serverContext = createHTTPConnector("http://localhost:" + server.address().port);
    _eval = async (script, env?) => {
      try {
        return await evalAsPromise(serverContext, script, env);
      } catch (e) {
        throw e.value || e;
      }
    };
  });
  after(() => server.close());

  it("should get remote object", async () => {
    const result = await _eval("me");
    assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  });
});

describe("References acquisition", () => {
  let context,
    _globalEnv,
    _eval,
    _encounteredReferences = new Set(),
    _finalReferences = new Set(),
    _parentOf = new Map<object, object>();
  before(() => {
    const me = {
      firstName: "User1",
      lastName: "Surname1",
      location: {
        country: "PL",
        address: {
          street: "Street 1",
          city: "City 1"
        }
      },
      setOnlineStatus(_flag) {},
      logout() {}
    };
    const val = { _id: "a value" };
    _globalEnv = {
      values: {
        repeated: [val, val],
        cyclic: {
          a: ["a"],
          b: ["b"]
        },
        me,
        posts: [
          {
            title: "Post1",
            body: "Body of post1",
            likedBy: [me]
          },
          {
            title: "Post2",
            body: "Body of post2",
            likedBy: [me]
          }
        ]
      }
    };
    _globalEnv.values.cyclic.a.push(_globalEnv.values.cyclic.b);
    //_globalEnv.values.cyclic.b.push(_globalEnv.values.cyclic.b);

    function belongsToRootEnv(value: any) {
      for (let k in _globalEnv.values) {
        if (_globalEnv.values[k] === value) {
          return true;
        }
      }
      return false;
    }
    function belongsToRootHeap(value) {
      while ((value = _parentOf.get(value))) {
        if (value === _globalEnv.values) {
          return true;
        }
      }
      return false;
    }

    function uuidv4() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    context = new MetaesContext(undefined, console.error, _globalEnv, {
      interpreters: {
        values: {
          GetProperty(e: NodeTypes.GetProperty, c, cerr, env, config) {
            const { object } = e;
            _encounteredReferences.add(object);
            GetProperty(
              e,
              value => {
                if (typeof value === "object" || typeof value === "function") {
                  _encounteredReferences.add(value);
                  _parentOf.set(value, object);
                }
                c(value);
              },
              cerr,
              env,
              config
            );
          },
          Identifier(e, c, cerr, env, config) {
            Identifier(
              e,
              value => {
                if (typeof value === "object" || typeof value === "function") {
                  _encounteredReferences.add(value);
                  if (belongsToRootEnv(value)) {
                    _parentOf.set(value, _globalEnv.values);
                  }
                }
                c(value);
              },
              cerr,
              env,
              config
            );
          }
        },
        prev: ECMAScriptInterpreters
      }
    });
    _eval = async (script, env = { values: {} }) => {
      try {
        const result = await evalAsPromise(context, script, env);
        const ids = new Map();
        let counter = 0;

        function sourceify(rootValue, isVariable = false) {
          function _toSource(value: any, tabs: string, depth: number) {
            let type = typeof value;
            switch (type) {
              case "string":
                return `"${value}"`;
              case "boolean":
              case "number":
              case "undefined":
                return "" + value;
              case "function":
              case "object":
                if (value === null) {
                  return "null";
                }
                const isTop = isVariable && depth === 0 && value === rootValue;
                if (!isTop && _encounteredReferences.has(value) && belongsToRootHeap(value)) {
                  _finalReferences.add(value);
                  let id = ids.get(value);
                  if (!id) {
                    id = "ref" + counter++;
                    ids.set(value, id);
                  }
                  return id;
                } else if (Array.isArray(value)) {
                  return "[" + value.map(v => _toSource(v, tabs, depth + 1)).join(", ") + "]";
                } else if (typeof value === "function" && !_encounteredReferences.has(value)) {
                  return null;
                } else {
                  return (
                    "{\n" +
                    tabs +
                    "  " +
                    Object.getOwnPropertyNames(value)
                      .map(k => {
                        const source = _toSource(value[k], tabs + "  ", depth + 1);
                        return source ? k + ": " + source : null;
                      })
                      .filter(x => !!x)
                      .join(",\n" + tabs + "  ") +
                    `\n${tabs}}`
                  );
                }
              default:
                throw new Error(`Can't stringify value of type '${typeof value}'.`);
            }
          }
          return _toSource(rootValue, "", 0);
        }

        const source = sourceify(result);
        const refs = {};
        _finalReferences.forEach(ref => (refs[ids.get(ref)] = sourceify(ref, true)));
        console.log(">> Source:");
        [..._finalReferences].forEach(ref => {
          const variable = `${ids.get(ref)}=${sourceify(ref, true)};`;
          console.log(variable);
        });
        console.log(`(${source});`);
        console.log("<< End");
        return result;
      } catch (e) {
        throw e.value || e;
      }
    };
  });

  afterEach(() => {
    _finalReferences.clear();
    _encounteredReferences.clear();
    _parentOf.clear();
  });

  it("should acquire one reference", async () => {
    await _eval("me");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire multiple references in array", async () => {
    await _eval(`[me, posts]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should acquire multiple references in object", async () => {
    await _eval(`({me, posts})`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should not acquire local references", async () => {
    await _eval(`var local = 'anything'; [local,me]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references only for returned value", async () => {
    await _eval(`posts; me`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references under different name, but pointing to the same object.", async () => {
    await _eval(`var _me = me; _me;`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire any deep references", async () => {
    await _eval(`posts; me; [me.location, me.location.address, "a string", 1, true, false, null]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.location, _globalEnv.values.me.location.address]);
  });

  it("should acquire no refrences", async () => {
    await _eval(`me.location.address.street`);
    assert.sameMembers([..._finalReferences], []);
  });

  it("should support functions", async () => {
    await _eval(`me.logout; me.setOnlineStatus`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.setOnlineStatus]);
  });

  it("should support functions properties serialization", async () => {
    await _eval(`[me, me.setOnlineStatus]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.me.setOnlineStatus]);
  });

  it("should support repeating values", async () => {
    await _eval(`repeated;`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.me.setOnlineStatus]);
  });
});

function getBindingInterpretersFor(otherContext: Context) {
  const remoteObjects = new WeakSet();
  const mappingContext: Context = {
    evaluate(input, c, cerr, env, config) {
      otherContext.evaluate(input, c, cerr, env, config);
    }
  };
  return {
    values: {
      Apply({ e, fn, thisValue, args }, c, cerr, _env, config) {
        if (remoteObjects.has(thisValue)) {
          const values = Object.assign(
            { fn },
            args.reduce((result, next, i) => {
              result["arg" + i] = next;
              return result;
            }, {})
          );
          const callee = thisValue
            ? {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: thisValue
                },
                property: e.callee.property
              }
            : {
                type: "Identifier",
                name: "fn"
              };
          mappingContext.evaluate(
            {
              type: "CallExpression",
              callee,
              arguments: args.map((_, i) => ({ type: "Identifier", name: "arg" + i }))
            },
            c,
            cerr,
            {
              values
            },
            config
          );
        } else {
          Apply.apply(null, arguments);
        }
      },
      GetProperty({ object, property }, c, cerr) {
        if (remoteObjects.has(object)) {
          mappingContext.evaluate(
            {
              type: "MemberExpression",
              object: { type: "Identifier", name },
              property: { type: "Identifier", name: property }
            },
            c,
            cerr,
            {
              values: { [name]: object }
            }
          );
        } else {
          GetProperty.apply(null, arguments);
        }
      },
      SetProperty({ object, property, value, operator }, c, cerr) {
        // object instanceof RemoteObject
        //   ? mappingContext.evaluate(`${remoteObjectsToNames.get(object)}.${property}${operator}${value}`, c, cerr)
        //   : SetProperty.apply(null, arguments);

        SetProperty.apply(null, arguments);
      },
      Identifier(e, c, cerr, env, config) {
        Identifier(
          e,
          c,
          exception => {
            const { type } = exception;
            if (type === "ReferenceError") {
              otherContext.evaluate(
                e,
                value => {
                  if (typeof value === "object") {
                    remoteObjects.add(value);
                  }
                  c(value);
                },
                cerr
              );
            } else {
              cerr(exception);
            }
          },
          env,
          config
        );
      }
    },
    prev: ECMAScriptInterpreters
  };
}
