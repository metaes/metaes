import { describe, it } from "mocha";
import { assert } from "chai";
import { showException } from "../../lib/exceptions";
import { createScript, metaesEval } from "../../lib/metaes";

const errorMessage = `test/from-html.spec.ts:2:6 - ReferenceError: "err" is not defined.
  21|  function run(){
  22|    2 + err / 4;
             ~~~
  23|  }
  24|  run();`;

describe("Exceptions printing", function () {
  it("prints basic exception", function () {
    const source = `function run(){
  2 + err / 4;
}
run();`;
    const script = createScript(source);
    script.url = `test/from-html.spec.ts`;

    let exception;
    metaesEval(source, console.log, (_ex) => (exception = _ex));
    const result = showException(script, exception, false);
    console.log(result);
    assert.equal(result, errorMessage);
  });
});
