require("source-map-support").install();

import { assert } from "chai";
import { after, before, beforeEach, describe, it } from "mocha";
import { Environment } from "./environment";
import { NotImplementedException } from "./exceptions";
import { Apply, GetProperty, Identifier } from "./interpreter/base";
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
  patchNodeFetch,
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

  defineTestsFor("Remote HTTP messaging", () => createHTTPConnector("http://localhost:" + server.address().port));
  defineTestsFor("Remote WebSocket messaging", () =>
    createWSConnector(W3CWebSocket)(`ws://localhost:` + server.address().port)
  );
});

function defineTestsFor(describeName: string, getContext: () => Promise<Context> | Context) {
  describe(describeName, () => {
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
}

describe("Raw HTTP calls", () => {
  let server, url;

  before(async () => {
    server = await runWSServer();
    url = `http://localhost:` + server.address().port;
    patchNodeFetch();
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
  let remoteContext: MetaesContext, interpreters: Environment, localContext: MetaesContext;

  before(() => {
    remoteContext = new MetaesContext(undefined, undefined, {
      values: {
        stringMessage: "Hello",
        objectMessage: { value: "Hello" },
        storage: {
          addFile(contents, name) {
            return contents.length > 5 && name.indexOf(".") > 0;
          }
        }
      }
    });

    interpreters = {
      values: {
        Apply({ fn, thisObj, args }, c, cerr) {
          if (thisObj instanceof RemoteObject) {
            remoteContext.evaluate({ type: "Apply", fn, thisObj, args }, c, cerr, { values: { fn, thisObj, args } });
          } else {
            Apply.apply(null, arguments);
          }
        },
        GetProperty({ object, property }, c, cerr) {
          if (object instanceof RemoteObject) {
            cerr(NotImplementedException(`Remote property access is not supported yet: ${object}.${property}`));
          } else {
            GetProperty.apply(null, arguments);
          }
        },
        Identifier(e, c, cerr, env, config) {
          Identifier(
            e,
            c,
            exception => {
              const { type } = exception;
              if (type === "ReferenceError") {
                remoteContext.evaluate(
                  e,
                  value =>
                    c(
                      typeof value === "object" && !(value instanceof RemoteObject)
                        ? /**
                           * A case when remote context is just other object in the same VM.
                           * Want to convert it to RemoteObject anyway, because changing object
                           * in non-original context may cause observations or interceptors break.
                           */
                          RemoteObject.create()
                        : value
                    ),
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
    localContext = new MetaesContext(undefined, undefined, { values: {} }, { interpreters });
  });

  it("should query remote primitive value from different context", async () => {
    assert.equal("Hello", await localContext.evalAsPromise("stringMessage"));
  });

  it("should query object value from different context", async () => {
    assert.isTrue(
      (await localContext.evalAsPromise("objectMessage")) instanceof RemoteObject,
      "object is transferred as a RemoteObject reference"
    );
    assert.equal(
      await localContext.evalAsPromise("objectMessage.value"),
      2,
      "remote object property access is executed on remote context"
    );
  });

  it("should call remote method with local arguments", async () => {
    try {
      await localContext.evalAsPromise(`let extension="txt"; storage.addFile(contents, "test" + "." + extension);`, {
        values: { contents: "File contents" }
      });
    } catch (e) {
      throw e.value || e;
    }
  });
});
