import { assert } from "chai";
import { describe, it } from "mocha";
import { toFullyQualifiedMessage } from "../../lib/remote";

describe.only("Metaes messages", () => {
  function fqMessageEqual(input, output) {
    assert.deepEqual(toFullyQualifiedMessage(input), output);
  }
  it("bare JSON array", () => fqMessageEqual([1, 2, 3], { input: [1, 2, 3], env: { values: {} } }));

  it("bare JSON object", () => fqMessageEqual({ a: 1, b: 2 }, { input: { a: 1, b: 2 }, env: { values: {} } }));

  it("JSON as input", () => fqMessageEqual({ input: "[1,2,3]" }, { input: [1, 2, 3], env: { values: {} } }));

  it("quoted JSON", () =>
    fqMessageEqual(
      { input: '["@id",2,3]', refs: { id: { type: "array" } } },
      { input: ["@id", 2, 3], env: { values: {}, refs: { id: { type: "array" } } } }
    ));

  it("Bare JavaScript", () => fqMessageEqual("2+2", { input: "2+2", env: { values: {} } }));

  it("JavaScript as input", () =>
    fqMessageEqual({ input: "[1,2,foo]", env: { foo: 3 } }, { input: "[1,2,foo]", env: { values: { foo: 3 } } }));

  it("Refs and env at the same time", () =>
    fqMessageEqual(
      { input: "foo", refs: { foo: { type: "object" } }, env: { foo: 3 } },
      { input: "foo", env: { values: { foo: 3 }, refs: { foo: { type: "object" } } } }
    ));

  it("Nested env", () =>
    fqMessageEqual(
      { input: "foo", env: { refs: { foo: { type: "object" } }, values: { foo: 3 } } },
      { input: "foo", env: { values: { foo: 3 }, refs: { foo: { type: "object" } } } }
    ));
});
