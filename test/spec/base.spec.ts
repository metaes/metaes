import { assert } from "chai";
import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";

describe("Base interpreters", () => {
  describe("Apply", () => {
    it("should accept calls with function reference only", () => {
      let acceptedArgs;
      function foo(...args) {
        acceptedArgs = args;
      }
      metaesEval({ type: "Apply", fn: foo, args: [1, 2] }, null, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });

    it("should accept calls with function and defined `this` value", () => {
      let acceptedArgs;
      let object = {
        method(...args) {
          acceptedArgs = args;
        }
      };
      metaesEval({ type: "Apply", fn: object.method, thisValue: object, args: [1, 2] }, null, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });
  });
});
