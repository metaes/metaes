import { expect } from "chai";
import { describe, it } from "mocha";
import { createCache, parse } from "./parse";

describe("Parse", () => {
  it("should use cache", () => {
    const cache = createCache();

    ["a", "b"].forEach(source => {
      expect(cache.get(source)).to.undefined;
      parse(source, {}, cache);
      expect(cache.get(source)).not.to.undefined;
    });
  });
});
