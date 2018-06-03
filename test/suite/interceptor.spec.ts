import { describe, it } from "mocha";
import { assert } from "chai";
import { metaesEval } from "../../lib/metaes";

describe("Interceptor", () => {
  it("should be called specific amount of times", () => {
    let results: any[] = [];
    function onError(e) {
      console.log(e);
    }
    function interceptor(e) {
      results.push(e);
    }
    function noop() {}
    metaesEval("2", noop, noop, {}, { interceptor, onError });
    assert.equal(results.length, 6);
  });
});
