// test: calls a function
function fn(value) {
  return value;
}
assert.equal(fn`test`, "test");

// test: template-literal
let a = 1;
assert.equal(`test ${a}`, "test 1");
