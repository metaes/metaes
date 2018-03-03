import { describe, it } from "mocha";
import { assert } from "chai";
import { metaesEval } from "../../lib/metaes";
import { Evaluation } from "../../lib/types";

describe("Interceptor", () => {
  it("should be called", () => {
    let evaluations: Evaluation[] = [];
    function onError(e) {
      console.log(e);
    }
    function interceptor(e: Evaluation) {
      evaluations.push(e);
    }
    function noop() {}
    metaesEval("2", noop, noop, {}, { interceptor, onError });
    assert.equal(evaluations.length, 6);
  });
});
