import { describe, it } from "mocha";
import { expect } from "chai";
import { createCache, createCachedParse } from "./parse";

describe("Parse", () => {
  it("should use cache", () => {
    const cache = createCache();
    const cachedParse = createCachedParse(cache);

    ["a", "b"].forEach(source => {
      expect(cache.get(source)).to.undefined;
      cachedParse(source);
      expect(cache.get(source)).not.to.undefined;
    });
  });
});
