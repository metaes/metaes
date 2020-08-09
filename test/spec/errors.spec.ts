import { assert } from "chai";
import { describe, it } from "mocha";
import { presentException } from "../../lib/exceptions";
import { createScript, metaesEvalModule } from "../../lib/metaes";

const tests = {
  identifier: {
    source: "x",
    expected: `
anonymous:1:0 - ReferenceError: "x" is not defined.

  1|  x
      ~`
  },
  "binary expression on line 2": {
    source: `
2 + err / 4`,
    expected: `
anonymous:2:4 - ReferenceError: "err" is not defined.

  2|  2 + err / 4
          ~~~`
  },
  "throw statement with new expression": {
    source: `throw new Something`,
    expected: `
anonymous:1:10 - ReferenceError: "Something" is not defined.

  1|  throw new Something
                ~~~~~~~~~`
  },
  "identifier call expression": {
    source: `notdefined()`,
    expected: `
anonymous:1:0 - ReferenceError: "notdefined" is not defined.

  1|  notdefined()
      ~~~~~~~~~~`
  },
  "member expression call expression": {
    source: `[].something()`,
    expected: `
anonymous:1:0 - TypeError: [].something is not a function

  1|  [].something()
      ~~~~~~~~~~~~`
  },
  "unsupported ECMAScript parts: power operator": {
    source: `2 ** 2`,
    expected: `
anonymous:1:0 - Error: BinaryExpression operator "**" is not implemented yet.

  1|  2 ** 2
      ~~~~~~`
  }
};

// TODO: multiline errors
// TODO: very long line with (minified file)

describe("Exceptions printing", function () {
  Object.entries(tests).forEach(([testName, { source, expected }]) => {
    function body() {
      const script = createScript(source);

      let exception;
      metaesEvalModule(script, console.log, (_ex) => (exception = _ex));
      const result = presentException(exception, false);
      try {
        assert.equal(result, expected.trim());
      } catch (e) {
        console.log(result);
        throw e;
      }
    }
    testName.includes("[only]") ? it.only(testName.replace("[only]", ""), body) : it(testName, body);
  });
});
