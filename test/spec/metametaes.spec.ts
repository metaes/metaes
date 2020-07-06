import { assert } from "chai";
import { describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { createScript } from "../../lib/metaes";
import { getMetaMetaESEval } from "../../lib/metametaes";

describe("Meta MetaES", function () {
  it("evaluates binary expression with literals", async function () {
    try {
      const metaesEval = await getMetaMetaESEval();
      const script = createScript("5+5*5");
      return new Promise(function (resolve, reject) {
        metaesEval(
          script,
          (result) => {
            try {
              assert.equal(result, 30);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          (e) => {
            console.log(presentException(e));
            reject(e);
          }
        );
      });
    } catch (error) {
      console.log(error);
    }
  });
});
