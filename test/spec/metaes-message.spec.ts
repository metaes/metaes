import { assert, expect } from "chai";
import { before, describe, it } from "mocha";
import { evalFnBodyAsPromise } from "../../lib/metaes";
import { getSerializingContext, toFullyQualifiedMessage, unquote } from "../../lib/remote";

describe("Object responses to message", () => {
  let context, self;

  before(() => {
    const me = {
      firstName: "User1",
      lastName: "Surname1",
      location: {
        country: "PL",
        address: {
          street: "Street 1",
          city: "City 1"
        }
      },
      setOnlineStatus(_flag) {},
      logout() {}
    };
    const posts = Array.from({ length: 2 }).map((a, i) => ({ title: "Post" + i, comments: [{}, {}] }));
    self = { me, posts };
    context = getSerializingContext({ values: self });
  });

  it("should serialize", async () => {
    const result = toFullyQualifiedMessage(
      await evalFnBodyAsPromise({
        context,
        source: (me, posts) => {
          [
            { me, posts: posts.map(({ title, comments }) => ({ title, comments })) },
            me.location,
            { firstName: me.firstName, location: me.location }
          ];
        }
      })
    );
    assert.deepEqual(unquote(result), [
      {
        me: {},
        posts: [
          {
            title: "Post0",
            comments: {}
          },
          {
            title: "Post1",
            comments: {}
          }
        ]
      },
      {},
      {
        firstName: "User1",
        location: {}
      }
    ]);
    expect(Object.keys(result.env.refs!)).to.lengthOf(4);
  });
});

describe("Fully qualified messages", () => {
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

  it("bare JavaScript", () => fqMessageEqual("2+2", { input: "2+2", env: { values: {} } }));

  it("Empty string", () => fqMessageEqual("", { input: "", env: { values: {} } }));

  it("Empty input", () => fqMessageEqual({ input: "" }, { input: "", env: { values: {} } }));

  it("`refs` in `env` shouldn't be treated as environment refs, treat as a field name. Reason: `values` field is missing", () =>
    fqMessageEqual({ input: "", env: { refs: {} } }, { input: "", env: { values: { refs: {} } } }));

  it("stringified bare JSON - don't try to parse it", () =>
    fqMessageEqual(`[1,2,"foo"]`, { input: `[1,2,"foo"]`, env: { values: {} } }));

  it("JavaScript as input", () =>
    fqMessageEqual({ input: "[1,2,foo]", env: { foo: 3 } }, { input: "[1,2,foo]", env: { values: { foo: 3 } } }));

  it("JSON as input (almost JavaScript)", () =>
    fqMessageEqual({ input: `[1,2,"foo"]` }, { input: [1, 2, "foo"], env: { values: {} } }));

  it("refs and env at the same time", () =>
    fqMessageEqual(
      { input: "foo", refs: { foo: { type: "object" } }, env: { foo: 3 } },
      { input: "foo", env: { values: { foo: 3 }, refs: { foo: { type: "object" } } } }
    ));

  it("nested env", () =>
    fqMessageEqual(
      { input: "foo", env: { refs: { foo: { type: "object" } }, values: { foo: 3 } } },
      { input: "foo", env: { values: { foo: 3 }, refs: { foo: { type: "object" } } } }
    ));
});