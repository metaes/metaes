// test: computed object key
const key1 = "key1";
const obj = {
  [key1]: "value1"
};
assert.deepEqual(obj, { key1: "value1" });

// test: supports spread
let [a, b] = ["a", "b"];
assert.deepEqual({ ...{ a, b } }, { a, b });