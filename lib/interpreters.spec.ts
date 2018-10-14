import { describe, it, before } from "mocha";
import { MetaesContext } from "./metaes";

describe("Interpreters", () => {
  let context: MetaesContext;
  let me;

  before(() => {
    me = { firstName: "John", lastName: "Named" };
    context = new MetaesContext(undefined, console.error, { values: { me } });
  });

  it("should support custom GetValue", async () => {
    console.log("me", await context.evalFunctionBody(me => me));
  });
});
