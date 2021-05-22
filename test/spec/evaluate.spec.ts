import { assert } from "chai";
import { describe, it } from "mocha";
import { toEnvironment } from "../../lib/environment";
import { createScript } from "../../lib/script";
import { createDynamicApplication, getDynamic } from "./../../lib/evaluate";
import { BaseConfig, uncps } from "./../../lib/metaes";

describe("Evaluate helpers", () => {
  const config = { ...BaseConfig, script: createScript("empty") };

  it("supports dynamic variable getting", function () {
    const env = toEnvironment({
      foo: (a, b) => a + b
    });
    const foo = uncps(getDynamic)({ name: "foo" }, env, config);
    const result = foo(1, 2);
    assert.equal(result, 3);
  });

  it("supports dynamic application", function () {
    const env = toEnvironment({
      foo: ([a, b], c) => c(a + b)
    });
    const foo = uncps(createDynamicApplication("foo"));

    const result = foo([1, 2], env, config);
    assert.equal(result, 3);
  });
});
