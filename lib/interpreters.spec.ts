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
    let iterator = 1;
    let interpreters = {
      values: {
        GetProperty({ object }, c, _cerr) {
          if (object === me) {
            // Intentionally delay
            setTimeout(() => c(iterator++));
          } else {
            // make the `super` call
            GetProperty.apply(null, arguments);
          }
        }
      },
      prev: EcmaScriptInterpreters
    };
    context = new MetaesContext(undefined, console.error, { values: { me } }, { interpreters });
  });

  it("should support custom GetValue", async () => {
    assert.deepEqual(await context.evalFunctionBody(me => [me.firstName, me.lastName]), [1, 2]);
  });
});
