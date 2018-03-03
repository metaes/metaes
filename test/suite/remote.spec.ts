import { createTestServer } from "./remote/utils";
import { before, describe, it } from "mocha";
import { assert } from "chai";
import { createConnector, environmentToJSON } from "../../lib/remote";
import {
  evaluatePromisified,
  evalFunctionBody,
  ScriptingContext,
  consoleLoggingMetaesContext
} from "../../lib/metaes";

const W3CWebSocket = require("websocket").w3cwebsocket;

describe("Messages", () => {
  let context: ScriptingContext;
  before(() => {
    context = consoleLoggingMetaesContext();
  });

  it("should properly serialize basic environment", () => {
    const primitiveValues = { foo: "bar", a: 1, b: false };
    assert.deepEqual(environmentToJSON(context, { values: primitiveValues }), { values: primitiveValues });
  });
});

describe.skip("Remote websocket messaging", () => {
  let connection;
  before(async () => {
    await createTestServer(8083);
    connection = await createConnector(W3CWebSocket)(`ws://localhost:8083`);
  });

  it("should correctly deliver primitive success value", async () =>
    assert.equal(4, await evaluatePromisified(connection, "2+2")));

  it("should correctly deliver primitive success value in multiple simultaneous contexts", async () => {
    assert.equal(4, await evaluatePromisified(connection, "2+2"));
    assert.equal(2, await evaluatePromisified(connection, "1+1"));
  });

  it("should correctly deliver primitive success value using continuation", () =>
    new Promise((resolve, reject) => {
      connection.evaluate("2+2", {}, value => {
        console.log("value ok", { value });
        try {
          assert.equal(value, 4);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  it("should correctly behave when c and cerr are not defined and result is correct", () => connection.evaluate("2+2"));

  it("should correctly behave (do not forward throwing) when cerr is not defined, evaluation is synchronous and result is incorrect", async () => {
    connection.evaluate("throw 1;");
  });

  it("should correctly deliver primitive success value and use env", async () =>
    assert.equal(4, await evaluatePromisified(connection, "2+a", { values: { a: 2 } })));

  it("should correctly deliver non-primitve success value and use env", async () => {
    let value = [1, 2, 3];
    assert.equal(
      value.toString(),
      (await evaluatePromisified(connection, "a", { values: { a: [1, 2, 3] } })).toString()
    );
  });

  it("should return correct value reading a disk file", async () => {
    assert.equal(
      require("child_process")
        .execSync("cat tsconfig.json")
        .toString(),
      await evalFunctionBody(connection, child_process =>
        child_process.execSync("cat tsconfig.json").toString()
      )
    );
  });

  it("should throw reference error", async () => {
    let flag = false;
    try {
      await evalFunctionBody(connection, window => window); // window is undefined on nodejs
    } catch (e) {
      if (e) {
        flag = true;
      }
    }
    assert.equal(true, flag);
  });

  it("should write a file to disk correctly", async () => {
    let contents = "Hello Node2.js";
    await evalFunctionBody(
      connection,
      fs => {
        fs.writeFileSync("message.txt", contents, err => {
          if (err) throw err;
        });
      },
      { values: { contents } }
    );

    assert.equal(
      contents,
      await evalFunctionBody(connection, child_process =>
        child_process.execSync("cat message.txt").toString()
      )
    );
  });

  it("should correctly call local stub for remote function and get result", async () => {});
});
