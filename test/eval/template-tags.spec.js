// test: calls a function
function fn(value) {
  return value;
}
assert.equal(fn`test`, "test");

// test: template literal
let a = 1;
assert.equal(`test ${a}`, "test 1");

// test: template literal with multiple quasis
const property = "prop";
const object = null;
assert.equal(`Cannot read property '${property}' of ${typeof object}`, "Cannot read property 'prop' of object");
