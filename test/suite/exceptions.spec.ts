
import { describe, it } from "mocha";
import { metaesEval } from "../../lib/metaes";

describe("Exceptions", () => {
  it("should throw ReferenceError", () =>
    new Promise((resolve, _reject) => {
      metaesEval(`a`, null, resolve);
    }));
  describe("From host functions", () => {});
  describe("From MetaES functions", () => {});
});
