// test: calls a function
function fn(value) {
  return value;
}
assert.equal(fn`test`, "test");
