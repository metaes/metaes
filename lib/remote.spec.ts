require("source-map-support").install();

import { assert } from "chai";
import { after, before, afterEach, beforeEach, describe, it } from "mocha";
import { Environment, getEnvironmentForValue } from "./environment";
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

describe.only("References acquisition", () => {
  let context,
    _globalEnv,
    _eval,
    _allReferences: [string, any][] = [],
    _remainingReferences: [string, any][] = [];
  before(() => {
    const me = {
      firstName: "User1",
      lastName: "Surname1",
      setOnlineStatus(_flag) {},
      logout() {}
    };
    _globalEnv = {
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
    };
    context = new MetaesContext(undefined, console.error, _globalEnv, {
      interceptor({ e, value, phase, env }) {
        if (e.type === "Identifier" && phase === "exit") {
          _allReferences.push([e.name, value]);
          // console.log(e.type, value);
          // console.log("env", getEnvironmentForValue(env, e.name));
        }
      }
    });
    _eval = async (script, env = { values: {} }) => {
      try {
        const result = await evalAsPromise(context, script, env);
        function getRootEnvKey(value: any) {
          for (let k in _globalEnv.values) {
            if (_globalEnv.values[k] === value) {
              return k;
            }
          }
          return null;
        }
        let k;
        JSON.stringify(result, function(key, value) {
          if (
            typeof value === "object" &&
            (k = getRootEnvKey(value)) &&
            !_remainingReferences.find(([_k, _v]) => _v === value)
          ) {
            let newName;
            // check for possible new name
            _allReferences.find(([_k, _v]) => {
              if (_v === value) {
                newName = _k;
                return true;
              }
              return false;
            });
            _remainingReferences.push([newName || k, value]);
          }
          return value;
        });
        return result;
      } catch (e) {
        throw e.value || e;
      }
    };
  });
  afterEach(() => {
    _remainingReferences.length = _allReferences.length = 0;
  });

  it("should acquire one reference", async () => {
    await _eval("me");
    assert.deepEqual(_remainingReferences, [["me", _globalEnv.values.me]]);
  });

  it("should acquire multiple references", async () => {
    await _eval(`[me, posts]`);
    assert.deepEqual(_remainingReferences, [["me", _globalEnv.values.me], ["posts", _globalEnv.values.posts]]);
    // assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  });

  it("should not acquire local references", async () => {
    await _eval(`var local = 'anything'; [local,me]`);
    assert.deepEqual(_remainingReferences, [["me", _globalEnv.values.me]]);
    // assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  });

  it("should acquire references only for returned value", async () => {
    await _eval(`posts; me`);
    assert.deepEqual(_remainingReferences, [["me", _globalEnv.values.me]]);
    // assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  });

  it("should acquire references under different name, but pointing to the same object.", async () => {
    await _eval(`var _me = me; _me;`);
    assert.deepEqual(_remainingReferences, [["me", _globalEnv.values.me]]);
    // assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  });

  // it("should acquire multiple references", async () => {
  //   const result = await _eval(`[me, posts, posts[0], posts[0].likedBy, posts[0].likedBy[0]]`);
  //   console.log("_references", _references);
  //   assert.equal(Object.keys(result), [], "remote objects by default don't send any keys");
  // });
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
