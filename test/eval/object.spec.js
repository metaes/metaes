// test: computed object key
const key1 = "key1";
const obj = {
  [key1]: "value1"
};
assert.deepEqual(obj, { key1: "value1" });
