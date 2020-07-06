import { assert } from "chai";
import { describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { createScript } from "../../lib/metaes";
import { importTSModule } from "../../lib/metametaes";

describe("Meta MetaES", function () {
  it("evaluates binary expression with literals", async function () {
    try {
      const metaes = await importTSModule("lib/metaes.ts");
      const script = createScript("5+5*5");
      return new Promise(function (resolve, reject) {
        metaes.metaesEval(
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
