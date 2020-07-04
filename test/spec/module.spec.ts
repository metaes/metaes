import { assert } from "chai";
import { describe, it } from "mocha";
import { metaesEvalModule } from "../../lib/metaes";

describe("Import/exports", () => {
  it.skip("exports named export", () => {
    let result;
    metaesEvalModule(`export function function1() {}`, _result => (result = _result));
    assert.hasAllKeys(result, ["function1"]);
  });
});
