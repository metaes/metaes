import { assert } from "chai";
import { describe, it } from "mocha";
import { toEnvironment } from "../../lib/environment";
import { createScript } from "../../lib/script";
import { Environment, EvaluationConfig } from "../../lib/types";
import { createDynamicApplication, getDynamic, getDynamicMany, getSuperEnv } from "./../../lib/evaluate";
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

  it("supports multiple variables getting", function () {
    const env = toEnvironment({ values: { a: 1, b: "value" }, prev: { values: { c: false } } });

    const takeVars = (env: Environment, config: EvaluationConfig) =>
      uncps(getDynamicMany<{ a: number; b: string; c: boolean }>())(["a", "b", "c"], env, config);

    const { a, b, c } = takeVars(env, config);

    assert.deepEqual({ a, b, c }, { a: 1, b: "value", c: false });
  });

  it("supports dynamic application", function () {
    const env = toEnvironment({
      foo: ([a, b], c) => c(a + b)
    });
    const foo = uncps(createDynamicApplication("foo"));

    const result = foo([1, 2], env, config);
    assert.equal(result, 3);
  });

  describe("getSuperEnv", function () {
    it("finds parent env", function () {
      const env: Environment = { values: { name: "a" }, prev: { values: {}, prev: { values: { name: "b" } } } };
      assert.equal(getSuperEnv("name", env)!.values.name, "b");
    });
  });
});
