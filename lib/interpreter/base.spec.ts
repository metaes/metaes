import { assert } from "chai";
import { describe, it } from "mocha";
import { metaesEval } from "../metaes";

describe("Base interpreters", () => {
  describe("Apply", () => {
    it("should accept calls with function reference", () => {
      let acceptedArgs;
      function foo(...args) {
        acceptedArgs = args;
      }
      metaesEval({ type: "Apply", fn: foo, args: [1, 2] }, console.log, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });

    it("should accept calls with function string name and defined this object", () => {
      let acceptedArgs;
      let object = {
        method(...args) {
          acceptedArgs = args;
        }
      };
      metaesEval({ type: "Apply", fn: "method", thisObj: object, args: [1, 2] }, console.log, console.error);
      assert.deepEqual(acceptedArgs, [1, 2]);
    });

    it("should not accept calls with string name and no this object", () => {
      let error;
      metaesEval({ type: "Apply", fn: "foo", args: [1, 2] }, console.log, e => (error = e.value));
      assert.instanceOf(error, TypeError);
    });
  });
});
