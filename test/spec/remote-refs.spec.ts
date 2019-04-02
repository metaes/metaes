require("source-map-support").install();

import { assert } from "chai";
import { afterEach, before, describe, it } from "mocha";
import { GetProperty, Identifier, Apply } from "../../lib/interpreter/base";
import { ECMAScriptInterpreters } from "../../lib/interpreters";
import { evalAsPromise, MetaesContext, evalFnBodyAsPromise } from "../../lib/metaes";
import * as NodeTypes from "../../lib/nodeTypes";
import { environmentToMessage } from "../../lib/remote";
import { GetValue } from "../../lib/environment";

describe.only("References acquisition", () => {
  let context,
    _globalEnv,
    quotedRequest,
    _encounteredReferences = new Set(),
    _finalReferences = new Set(),
    _parentOf = new Map<object, object>(),
    _ids = new Map(),
    _finalResponse,
    _finalValues;

  afterEach(() => {
    _finalReferences.clear();
    _encounteredReferences.clear();
    _parentOf.clear();
    _ids.clear();
  });
  before(() => {
    function belongsToRootEnv(value: any) {
      for (let k in _globalEnv.values) {
        if (_globalEnv.values[k] === value) {
          return true;
        }
      }
      return false;
    }
    function belongsToRootHeap(value) {
      while ((value = _parentOf.get(value))) {
        if (value === _globalEnv.values) {
          return true;
        }
      }
      return false;
    }

    const interpreters = {
      values: {
        Apply(e) {
          const { thisValue, fn } = e;
          if (
            thisValue &&
            Array.isArray(thisValue) &&
            (belongsToRootEnv(thisValue) || belongsToRootHeap(thisValue)) &&
            (fn === [].map || fn === [].filter)
          ) {
            thisValue
              .filter(element => typeof element === "object" || typeof element === "function")
              .forEach(element => {
                _encounteredReferences.add(element);
                _parentOf.set(element, thisValue);
              });
          }
          Apply.apply(null, arguments);
        },
        GetValue({ name }, _c, _cerr, env) {
          const obj = env.values;
          if (
            belongsToRootEnv(obj) ||
            ((belongsToRootHeap(obj) && typeof obj[name] === "object") || typeof obj[name] === "function")
          ) {
            _parentOf.set(obj[name], obj);
          }
          GetValue.apply(null, arguments);
        },
        GetProperty(e: NodeTypes.GetProperty, c, cerr, env, config) {
          const { object } = e;
          _encounteredReferences.add(object);
          GetProperty(
            e,
            value => {
              if (typeof value === "object" || typeof value === "function") {
                _encounteredReferences.add(value);
                _parentOf.set(value, object);
              }
              c(value);
            },
            cerr,
            env,
            config
          );
        },
        Identifier(e, c, cerr, env, config) {
          Identifier(
            e,
            value => {
              if (typeof value === "object" || typeof value === "function") {
                _encounteredReferences.add(value);
                if (belongsToRootEnv(value)) {
                  _parentOf.set(value, _globalEnv.values);
                }
              }
              c(value);
            },
            cerr,
            env,
            config
          );
        }
      },
      prev: ECMAScriptInterpreters
    };

    quotedRequest = async (script, env = { values: {} }) => {
      try {
        const result =
          typeof script === "function"
            ? await evalFnBodyAsPromise({ context, source: script }, env)
            : await evalAsPromise(context, script, env);

        let counter = 0;

        function sourceify2(value) {
          return JSON.stringify(
            value,
            function replacer(key, value) {
              if (_encounteredReferences.has(value) && belongsToRootHeap(value)) {
                _finalReferences.add(value);
                let id = _ids.get(value);
                if (!id) {
                  id = "@ref" + counter++;
                  _ids.set(value, id);
                }
                return id;
              } else {
                return value;
              }
            },
            2
          );
        }
        const source = sourceify2(result);
        // const variables = [..._finalReferences]
        //   .reverse()
        //   .map(ref => `${_ids.get(ref)}=${sourceify2(ref)};`)
        //   .join("\n");
        _finalResponse = source;

        _finalValues = [..._ids.entries()].reduce((result, [k, v]) => {
          result[v] = k;
          return result;
        }, {});
        // do not return
        result;
        return JSON.parse(_finalResponse);
      } catch (e) {
        throw e.value || e;
      }
    };
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
    _globalEnv = {
      values: {
        repeated: [val, val],
        me,
        posts: Array.from({ length: 5 }).map((_, i) => ({
          title: "Post" + i,
          body: "Body of post" + i,
          comments: [comment1, comment2, comment3],
          likedBy: [me]
        }))
      }
    };
    context = new MetaesContext(undefined, console.error, _globalEnv, {
      interpreters
    });
  });

  it("should send stringified non root heap object", async () => {
    await quotedRequest(function() {
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
    });
    console.log("[references]:", {
      references: environmentToMessage(context, {
        values: _finalValues
      }).references
    });
    console.log("[Response]:");
    console.log(_finalResponse);
  });

  it("should acquire one reference", async () => {
    assert.equal(await quotedRequest("me"), "@ref0");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
    console.log(
      environmentToMessage(context, {
        values: _finalValues
      })
    );
  });

  it("should acquire multiple references in array", async () => {
    assert.deepEqual(await quotedRequest(`[me, posts]`), ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should acquire multiple references in object", async () => {
    assert.deepEqual(await quotedRequest(`({me, posts})`), { me: "@ref0", posts: "@ref1" });
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should not acquire local references", async () => {
    assert.deepEqual(await quotedRequest(`var local = 'anything'; [local,me]`), ["anything", "@ref0"]);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references only for returned value", async () => {
    assert.deepEqual(await quotedRequest(`posts; me`), "@ref0");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references under different name, but pointing to the same object.", async () => {
    assert.deepEqual(await quotedRequest(`var _me = me; _me;`), "@ref0");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire any deep references", async () => {
    assert.deepEqual(
      await quotedRequest(`posts; me; [me.location, me.location.address, "a string", 1, true, false, null]`),
      ["@ref0", "@ref1", "a string", 1, true, false, null]
    );
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.location, _globalEnv.values.me.location.address]);
  });

  it("should acquire no refrences", async () => {
    assert.equal(await quotedRequest(`me.location.address.street`), "Street 1");
    assert.sameMembers([..._finalReferences], []);
  });

  it("should support functions", async () => {
    assert.deepEqual(await quotedRequest(`me.logout; me.setOnlineStatus`), "@ref0");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.setOnlineStatus]);
  });

  it("should support functions properties serialization", async () => {
    assert.deepEqual(await quotedRequest(`[me, me.setOnlineStatus]`), ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.me.setOnlineStatus]);
  });

  it("should support repeating values as one reference", async () => {
    assert.deepEqual(await quotedRequest(`[repeated, repeated]`), ["@ref0", "@ref0"]);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.repeated]);
  });

  it("should destruct references chain", async () => {
    assert.deepEqual(await quotedRequest(`[repeated, repeated[0]]`), ["@ref0", "@ref1"]);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.repeated, _globalEnv.values.repeated[0]]);
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
