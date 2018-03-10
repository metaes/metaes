import { createTestServer } from "./utils";
import { before, describe, it } from "mocha";
import { assert } from "chai";
import { createConnector } from "../../..//lib/remote";
import { evalToPromise, evalFunctionBody } from "../../../lib/metaes";

const W3CWebSocket = require("websocket").w3cwebsocket;

// TODO: merge it with `evaluation` tests and run first with "normal" context, then with remote
// behind websockets
describe("Remote websocket messaging", () => {
  let connection;
  before(async () => {
    await createTestServer(8083);
    connection = await createConnector(W3CWebSocket)(`ws://localhost:8083`);
  });

  it("should correctly deliver primitive success value", async () =>
    assert.equal(4, await evalToPromise(connection, "2+2")));

  it("should correctly deliver primitive success value in multiple simultaneous contexts", async () => {
    assert.equal(4, await evalToPromise(connection, "2+2"));
    assert.equal(2, await evalToPromise(connection, "1+1"));
  });

  it("should correctly deliver primitive success value using environment in multiple simultaneous contexts", async () => {
    assert.equal(4, await evalToPromise(connection, "a+b", { values: { a: 1, b: 3 } }));
    assert.equal(2, await evalToPromise(connection, "a-b", { values: { a: 4, b: 2 } }));
  });

  it("should correctly deliver primitive success value using continuation", () =>
    new Promise((resolve, reject) => {
      connection.evaluate("2+2", value => {
        try {
          assert.equal(value, 4);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  it("should not throw when c and cerr are not defined and result is correct", () => connection.evaluate("2+2"));

  it("should not throw when cerr is not defined, evaluation is synchronous and result is incorrect", async () => {
    connection.evaluate("throw 1;");
  });

  it("should correctly deliver primitive success value and use env", async () =>
    assert.equal(4, await evalToPromise(connection, "2+a", { values: { a: 2 } })));

  it("should correctly deliver non-primitve success value and use env", async () => {
    let value = [1, 2, 3];
    assert.equal(value.toString(), (await evalToPromise(connection, "a", { values: { a: [1, 2, 3] } })).toString());
  });

  it("should return correct value reading a disk file", async () => {
    assert.equal(
      require("child_process")
        .execSync("cat tsconfig.json")
        .toString(),
      await evalFunctionBody(connection, child_process => child_process.execSync("cat tsconfig.json").toString())
    );
  });

  it("should throw an exception", async () => {
    let thrown = false;
    try {
      await evalFunctionBody(connection, window => window); // window is undefined on nodejs
    } catch (e) {
      if (e) {
        thrown = true;
      }
    }
    assert.equal(true, thrown);
  });

  // TODO: change save file location and fix gitignore
  it("should write a file to disk correctly", async () => {
    let contents = "" + Math.random();
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
      await evalFunctionBody(connection, child_process => child_process.execSync("cat message.txt").toString())
    );
  });
});
