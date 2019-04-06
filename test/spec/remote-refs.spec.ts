require("source-map-support").install();

import { assert } from "chai";
import { before, describe, it } from "mocha";
import { Environment } from "../../lib/environment";
import { Context, evalAsPromise, evalFnBodyAsPromise } from "../../lib/metaes";
import { environmentToMessage, getSerializingContext } from "../../lib/remote";

describe.only("References acquisition", () => {
  let context: Context, unquote, globalEnv, quotedRequest, _finalReferences;

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
    const otherUser = {
      firstName: "Other-firstName",
      lastName: "Other-lastName"
    };
    const comment1 = {
      author: me,
      title: "Comment1"
    };
    const comment2 = {
      author: otherUser,
      title: "Comment2"
    };
    const comment3 = {
      author: otherUser,
      title: "Comment3"
    };
    const val = {};
    globalEnv = {
      values: {
        repeated: [val, val],
        me,
        posts: Array.from({ length: 2 }).map((_, i) => ({
          title: "Post" + i,
          body: "Body of post" + i,
          comments: [comment1, comment2, comment3],
          likedBy: [me]
        }))
      }
    };
    let { context: _context } = getSerializingContext(globalEnv);
    context = _context;

    quotedRequest = async function(input, env?: Environment) {
      const { response, _finalReferences: references, unquote: _unquote } = await evalAsPromise(context, input, env);
      _finalReferences = references;
      unquote = _unquote;
      return response;
    };
  });

  it("should send stringified non root heap object", async () => {
    const { response, _finalValues } = await evalFnBodyAsPromise({
      context,
      source: function(posts, me) {
        const { firstName, lastName, location } = me;
        ({
          firstName,
          lastName,
          location,
          posts,
          postsSliced: posts.slice(0, 1),
          postsMapped: posts.map(({ title, comments }) => ({ title, comments })),
          postsMappedDeeper: posts.map(({ title, comments }) => ({
            title,
            comments: comments.map(({ title }) => ({ title }))
          }))
        });
      }
    });

    assert.deepEqual(response, {
      firstName: "User1",
      lastName: "Surname1",
      location: "@ref0",
      posts: "@ref1",
      postsSliced: ["@ref2"],
      postsMapped: [
        {
          title: "Post0",
          comments: "@ref3"
        },
        {
          title: "Post1",
          comments: "@ref4"
        }
      ],
      postsMappedDeeper: [
        {
          title: "Post0",
          comments: [
            {
              title: "Comment1"
            },
            {
              title: "Comment2"
            },
            {
              title: "Comment3"
            }
          ]
        },
        {
          title: "Post1",
          comments: [
            {
              title: "Comment1"
            },
            {
              title: "Comment2"
            },
            {
              title: "Comment3"
            }
          ]
        }
      ]
    });
    console.log("[references]:", {
      references: environmentToMessage(context, {
        values: _finalValues
      }).references
    });
  });

  it("should acquire one reference", async () => {
    const response = await quotedRequest(`me`);
    assert.deepEqual(response, "@ref0");
    assert.sameMembers([..._finalReferences], [globalEnv.values.me]);
    assert.equal(unquote(response), unquote(response), "should unquote to the same value");
    assert.equal(unquote(await quotedRequest(`me`)), unquote(response));
    assert.equal(unquote(await quotedRequest(`ref`, { values: { ref: response } })), unquote(response));
    // console.log(
    //   environmentToMessage(context, {
    //     values: _finalValues
    //   })
    // );
  });

  it("should acquire multiple references in array", async () => {
    const response = await quotedRequest(`[me, posts]`);
    console.log("unquote", unquote(response));
    assert.deepEqual(response, ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [globalEnv.values.me, globalEnv.values.posts]);
  });

  it("should acquire multiple references in object", async () => {
    assert.deepEqual(await quotedRequest(`({me, posts})`), { me: "@ref0", posts: "@ref1" });
    assert.sameMembers([..._finalReferences], [globalEnv.values.me, globalEnv.values.posts]);
  });

  it("should not acquire local references", async () => {
    assert.deepEqual(await quotedRequest(`var local = 'anything'; [local,me]`), ["anything", "@ref0"]);
    assert.sameMembers([..._finalReferences], [globalEnv.values.me]);
  });

  it("should acquire references only for returned value", async () => {
    assert.deepEqual(await quotedRequest(`posts; me`), "@ref0");
    assert.sameMembers([..._finalReferences], [globalEnv.values.me]);
  });

  it("should acquire references under different name, but pointing to the same object.", async () => {
    assert.deepEqual(await quotedRequest(`var _me = me; _me;`), "@ref0");
    assert.sameMembers([..._finalReferences], [globalEnv.values.me]);
  });

  it("should acquire any deep references", async () => {
    assert.deepEqual(
      await quotedRequest(`posts; me; [me.location, me.location.address, "a string", 1, true, false, null]`),
      ["@ref0", "@ref1", "a string", 1, true, false, null]
    );
    assert.sameMembers([..._finalReferences], [globalEnv.values.me.location, globalEnv.values.me.location.address]);
  });

  it("should acquire no refrences", async () => {
    assert.deepEqual(await quotedRequest(`me.location.address.street`), "Street 1");
    assert.sameMembers([..._finalReferences], []);
  });

  it("should support functions", async () => {
    assert.deepEqual(await quotedRequest(`me.logout; me.setOnlineStatus`), "@ref0");
    assert.sameMembers([..._finalReferences], [globalEnv.values.me.setOnlineStatus]);
  });

  it("should support functions properties serialization", async () => {
    assert.deepEqual(await quotedRequest(`[me, me.setOnlineStatus]`), ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [globalEnv.values.me, globalEnv.values.me.setOnlineStatus]);
  });

  it("should support repeating values as one reference", async () => {
    assert.deepEqual(await quotedRequest(`[repeated, repeated]`), ["@ref0", "@ref0"]);
    assert.sameMembers([..._finalReferences], [globalEnv.values.repeated]);
  });

  it("should destruct references chain", async () => {
    assert.deepEqual(await quotedRequest(`[repeated, repeated[0]]`), ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [globalEnv.values.repeated, globalEnv.values.repeated[0]]);
  });

  it("should not support cyclic values", () =>
    new Promise((resolve, reject) =>
      quotedRequest(`
    let a = ["a"];
    let b = ["b"];
    a.push(b);
    b.push(b);
    a;
    `)
        .then(reject)
        .catch(resolve)
    ));
});
