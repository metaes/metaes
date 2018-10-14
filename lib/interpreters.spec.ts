import { assert } from "chai";
import { before, describe, it } from "mocha";
import { GetProperty } from "./interpreter/base";
import { EcmaScriptInterpreters } from "./interpreters";
import { MetaesContext } from "./metaes";

describe("Interpreters", () => {
  let context: MetaesContext;
  let me;

  before(() => {
    me = { firstName: "John", lastName: "Named" };
    let interpreters = {
      values: {
        GetProperty({ object, property }, c, _cerr) {
          if (object === me) {
            // Intentionally delay
            setTimeout(() => c(object[property]), 1);
          } else {
            GetProperty.apply(null, arguments);
          }
        }
      },
      prev: EcmaScriptInterpreters
    };
    context = new MetaesContext(undefined, console.error, { values: { me } }, { interpreters });
  });

  it("should support custom GetValue", async () => {
    assert.deepEqual(await context.evalFunctionBody(me => [me.firstName, me.lastName]), [me.firstName, me.lastName]);
  });
});
