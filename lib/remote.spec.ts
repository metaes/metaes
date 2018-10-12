import { assert } from "chai";
import { after, before, beforeEach, describe, it } from "mocha";
import { Environment } from "./environment";
import { consoleLoggingMetaesContext, Context, evalFunctionBody, evalToPromise } from "./metaes";
import {
  createWSConnector,
  environmentFromMessage,
  environmentToMessage,
  getReferencesMap,
  mergeValues,
  createHTTPConnector
} from "./remote";
import { runWSServer } from "./server";

let server, serverAlreadyAskedToStart;

const W3CWebSocket = require("websocket").w3cwebsocket;
export const testServerPort = 8082;

export async function createTestServer(port: number = testServerPort) {
  if (serverAlreadyAskedToStart && !server) {
    // periodically check if server is assigned
    return new Promise(resolve => {
      let interval = setInterval(() => {
        if (server) {
          clearInterval(interval);
          resolve(server);
        }
      }, 10);
    });
  } else if (server) {
    return Promise.resolve(server);
  } else {
    serverAlreadyAskedToStart = true;
    return (server = await runWSServer(port));
  }
}

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

defineTestsFor("Remote WebSocket messaging", () => createWSConnector(W3CWebSocket)(`ws://localhost:8083`));
defineTestsFor("Remote HTTP messaging", () => Promise.resolve(createHTTPConnector()));

function defineTestsFor(describeName: string, contextGetter: () => Promise<Context>) {
  describe(describeName, () => {
    let context;
    let server;

    before(async () => {
      server = await createTestServer(8083);
      context = await contextGetter();
    });

    after(() => server.close());

    it("should correctly deliver primitive success value", async () =>
      assert.equal(4, await evalToPromise(context, "2+2")));

    it("should correctly deliver primitive success value in multiple simultaneous contexts", async () => {
      assert.equal(4, await evalToPromise(context, "2+2"));
      assert.equal(2, await evalToPromise(context, "1+1"));
    });

    it("should correctly deliver primitive success value using environment in multiple simultaneous contexts", async () => {
      assert.equal(4, await evalToPromise(context, "a+b", { values: { a: 1, b: 3 } }));
      assert.equal(2, await evalToPromise(context, "a-b", { values: { a: 4, b: 2 } }));
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

    it("should not throw when cerr is not defined, evaluation is synchronous and result is incorrect", async () => {
      context.evaluate("throw 1;");
    });

    it("should correctly deliver primitive success value and use env", async () =>
      assert.equal(4, await evalToPromise(context, "2+a", { values: { a: 2 } })));

    it("should correctly deliver non-primitve success value and use env", async () => {
      let value = [1, 2, 3];
      assert.equal(
        value.toString(),
        (await evalToPromise(context, "a", {
          values: { a: [1, 2, 3] }
        })).toString()
      );
    });

    it("should return correct value reading a disk file", async () => {
      assert.equal(
        require("child_process")
          .execSync("cat tsconfig.json")
          .toString(),
        await evalFunctionBody(context, (child_process, command) => child_process.execSync(command).toString(), {
          values: { command: "cat tsconfig.json" }
        })
      );
    });

    it("should throw an exception", async () => {
      let thrown = false;
      try {
        await evalFunctionBody(context, window => window); // window is undefined on nodejs
      } catch (e) {
        if (e) {
          thrown = true;
        }
      }
      assert.equal(true, thrown);
    });
  });
}
