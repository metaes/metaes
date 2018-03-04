import { beforeEach, describe, it } from "mocha";
import { assert } from "chai";
import { environmentToJSON, environmentFromJSON, getReferenceMap } from "../../..//lib/remote";
import { ScriptingContext, consoleLoggingMetaesContext, MetaesContext, evalFunctionBody } from "../../../lib/metaes";
import { Environment } from "../../../lib/environment";

describe("Messages", () => {
  describe("Environment", () => {
    let context: ScriptingContext;
    let context2: ScriptingContext;

    beforeEach(() => {
      context = consoleLoggingMetaesContext();
      context2 = consoleLoggingMetaesContext();
    });

    it("should properly serialize/deserialize primitive values in enviromnent", () => {
      const primitiveValues = { foo: "bar", a: 1, b: false };
      assert.deepEqual(environmentToJSON(context, { values: primitiveValues }), { values: primitiveValues });
    });

    it("should properly serialize/deserialize object values in enviromnent", () => {
      function fn() {}
      const obj = { fn };
      const env: Environment = { values: { fn, obj } };
      const json = environmentToJSON(context, env);
      const envBack = environmentFromJSON(context, json);
      assert.deepEqual(env, envBack);
    });

    it("should properly serialize/deserialize object values in enviromnent with multiple contexts", () => {
      [context, context2].forEach(context => {
        function fn() {}
        const obj = { fn };
        const env: Environment = { values: { fn, obj } };
        const json = environmentToJSON(context, env);
        assert.equal(getReferenceMap(context).size, 2);
        const envBack = environmentFromJSON(context, json);
        assert.deepEqual(env, envBack);
        assert.equal(getReferenceMap(context).size, 2);
      });
    });
    it("should correctly execute scripting context", async () => {
      const context = new MetaesContext(undefined, undefined, { values: global });
      assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: 1 } }), 2);
    });
    it("should correctly execute cooperatively", async () => {
      const context = new MetaesContext(undefined, undefined, { values: global });
      [1, 2, 3, 4, 5, 6].forEach(async i => {
        assert.equal(await evalFunctionBody(context, a => a * 2, { values: { a: i } }), i * 2);
      });
    });
  });
});
