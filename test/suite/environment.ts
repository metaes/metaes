import { describe, it } from "mocha";
import { MetaESContext } from "../../lib/metaes";
import { environmentToJSON, environmentFromJSON } from "../../lib/remote";
import { assert } from "chai";

describe("Environment", () => {
  it("should convert environment back and forth", () => {
    function noop() {}
    let env = { values: { encodeURI, a: "teststring" } };
    let context = new MetaESContext(noop, noop, env);
    let to = environmentToJSON(context, env);
    assert.equal(environmentFromJSON(context, to).values["encodeURI"], encodeURI);
  });

  describe("Serialization", () => {
    it("should serialize primitive value", () => {
      const context1 = new MetaESContext();
    });
    it("should serialize array/object value", () => {});
  });
});
