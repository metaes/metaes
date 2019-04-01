require("source-map-support").install();

import { assert } from "chai";
import { afterEach, before, describe, it } from "mocha";
import { GetProperty, Identifier } from "../../lib/interpreter/base";
import { ECMAScriptInterpreters } from "../../lib/interpreters";
import { evalAsPromise, MetaesContext, evalFnBodyAsPromise } from "../../lib/metaes";
import * as NodeTypes from "../../lib/nodeTypes";
import { environmentToMessage } from "../../lib/remote";

describe.only("References acquisition", () => {
  let context,
    _globalEnv,
    _eval,
    _encounteredReferences = new Set(),
    _finalReferences = new Set(),
    _parentOf = new Map<object, object>(),
    _ids = new Map(),
    _finalSource,
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

    _eval = async (script, env = { values: {} }) => {
      try {
        const result =
          typeof script === "function"
            ? await evalFnBodyAsPromise({ context, source: script }, env)
            : await evalAsPromise(context, script, env);

        let counter = 0;

        function sourceify(rootValue, isVariable = false) {
          function _toSource(value: any, tabs: string, depth: number) {
            let type = typeof value;
            switch (type) {
              case "string":
                return `"${value}"`;
              case "boolean":
              case "number":
              case "undefined":
                return "" + value;
              case "function":
              case "object":
                if (value === null) {
                  return "null";
                }
                const isTop = isVariable && depth === 0 && value === rootValue;
                if (!isTop && _encounteredReferences.has(value) && belongsToRootHeap(value)) {
                  _finalReferences.add(value);
                  let id = _ids.get(value);
                  if (!id) {
                    id = "ref" + counter++;
                    _ids.set(value, id);
                  }
                  return id;
                } else if (Array.isArray(value)) {
                  return "[" + value.map(v => _toSource(v, tabs, depth + 1)).join(", ") + "]";
                } else if (typeof value === "function" && !_encounteredReferences.has(value)) {
                  return null;
                } else {
                  return (
                    "{\n" +
                    tabs +
                    "  " +
                    Object.getOwnPropertyNames(value)
                      .map(k => {
                        const source = _toSource(value[k], tabs + "  ", depth + 1);
                        return source ? k + ": " + source : null;
                      })
                      .filter(x => !!x)
                      .join(",\n" + tabs + "  ") +
                    `\n${tabs}}`
                  );
                }
              default:
                throw new Error(`Can't stringify value of type '${typeof value}'.`);
            }
          }
          return _toSource(rootValue, "", 0);
        }
        const source = sourceify(result);
        const variables = [..._finalReferences]
          .reverse()
          .map(ref => `${_ids.get(ref)}=${sourceify(ref, true)};`)
          .join("\n");
        _finalSource = variables + "\n" + `(${source});`;

        _finalValues = [..._ids.entries()].reduce((result, [k, v]) => {
          result[v] = k;
          return result;
        }, {});
        return result;
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
    const val = {};
    _globalEnv = {
      values: {
        repeated: [val, val],
        me,
        posts: [
          {
            title: "Post1",
            body: "Body of post1",
            likedBy: [me]
          },
          {
            title: "Post2",
            body: "Body of post2",
            likedBy: [me]
          }
        ]
      }
    };
    context = new MetaesContext(undefined, console.error, _globalEnv, {
      interpreters
    });
  });

  it.only("should send stringified non root heap object", async () => {
    console.log(
      "result",
      await _eval(function() {
        const {
          firstName,
          lastName,
          location: {
            country,
            address: { street, city }
          }
        } = me;
        [me, me.location];
      })
    );
    console.log("[Source]:", _finalSource);
    console.log(
      environmentToMessage(context, {
        values: _finalValues
      })
    );
    assert.equal(
      await evalAsPromise(new MetaesContext(), _finalSource, { values: _finalValues }),
      {},
      "object is not stringified in default way"
    );
  });

  it("should acquire one reference", async () => {
    await _eval("me");
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
    console.log("[Source]:", _finalSource);
    console.log(
      environmentToMessage(context, {
        values: _finalValues
      })
    );
    assert.equal(
      await evalAsPromise(new MetaesContext(), _finalSource, { values: _finalValues }),
      {},
      "object is not stringified in default way"
    );
  });

  it("should acquire multiple references in array", async () => {
    await _eval(`[me, posts]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should acquire multiple references in object", async () => {
    await _eval(`({me, posts})`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.posts]);
  });

  it("should not acquire local references", async () => {
    await _eval(`var local = 'anything'; [local,me]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references only for returned value", async () => {
    await _eval(`posts; me`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire references under different name, but pointing to the same object.", async () => {
    await _eval(`var _me = me; _me;`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me]);
  });

  it("should acquire any deep references", async () => {
    await _eval(`posts; me; [me.location, me.location.address, "a string", 1, true, false, null]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.location, _globalEnv.values.me.location.address]);
  });

  it("should acquire no refrences", async () => {
    await _eval(`me.location.address.street`);
    assert.sameMembers([..._finalReferences], []);
  });

  it("should support functions", async () => {
    await _eval(`me.logout; me.setOnlineStatus`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me.setOnlineStatus]);
  });

  it("should support functions properties serialization", async () => {
    await _eval(`[me, me.setOnlineStatus]`);
    assert.sameMembers([..._finalReferences], [_globalEnv.values.me, _globalEnv.values.me.setOnlineStatus]);
  });

  it("should support repeating values as one reference", async () => {
    await _eval(`[repeated, repeated]`);
    console.log({ _finalReferences });
    assert.sameMembers([..._finalReferences], [_globalEnv.values.repeated]);
  });

  it("should destruct references chain", async () => {
    await _eval(`[repeated, repeated[0]]`);
    console.log({ _finalReferences });
    assert.sameMembers([..._finalReferences], [_globalEnv.values.repeated, _globalEnv.values.repeated[0]]);
  });

  it("should not support cyclic values", () =>
    new Promise((resolve, reject) =>
      _eval(`
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
