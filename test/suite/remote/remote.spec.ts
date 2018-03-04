import { before, describe, it } from "mocha";
import { assert } from "chai";
import { environmentToJSON, environmentFromJSON } from "../../..//lib/remote";
import { ScriptingContext, consoleLoggingMetaesContext } from "../../../lib/metaes";
import { Environment } from "../../../lib/environment";

describe("Messages", () => {
  describe("Environment", () => {
    let context: ScriptingContext;
    before(() => {
      context = consoleLoggingMetaesContext();
    });

    it("should properly serialize/deserialize primitive values in enviromnent", () => {
      const primitiveValues = { foo: "bar", a: 1, b: false };
      assert.deepEqual(environmentToJSON(context, { values: primitiveValues }), { values: primitiveValues });
    });

    it("should properly serialize/deserialize object values in enviromnent", () => {
      function fn() {}
      const obj = { fn };
      const env: Environment = { values: { fn, obj } };
      let json = environmentToJSON(context, env);
      let envBack = environmentFromJSON(context, json);

      assert.deepEqual(env, envBack);
    });
  });
});
