import { before, describe, it } from "mocha";
import { assert } from "chai";
import { environmentToJSON } from "../../..//lib/remote";
import { ScriptingContext, consoleLoggingMetaesContext } from "../../../lib/metaes";

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
