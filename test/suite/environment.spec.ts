import { beforeEach, describe, it } from "mocha";
import { assert } from "chai";
import { environmentToJSON, environmentFromJSON, getReferenceMap } from "../../lib/remote";
import { ScriptingContext, consoleLoggingMetaesContext,  } from "../../lib/metaes";
import { Environment, mergeValues } from "../../lib/environment";

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
  
  it("should properly add values to existing environment", () => {
    const env = { values: { a: 1 } };
    const env2 = mergeValues({ b: 2 }, env);

    console.log(env2)
  });
});
