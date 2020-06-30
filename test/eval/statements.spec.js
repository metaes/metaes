// test: assigns default value
let { d = 3 } = {};
assert.equal(d, 3);

// test: supports destruction assignment
let { a, b = 3, c = 4 } = { a: 1, b: 2 };
assert.equal(a, 1);
assert.equal(b, 2);
assert.equal(c, 4);

// test: supports deeper destruction assignment
let called = false;
function foo() {
  called = true;
  return 4;
}
let {
  a,
  b: { c = foo() }
} = { a: 1, b: { c: 2 } };

assert.equal(a, 1);
assert.equal(c, 2);
assert.equal(called, false);

// test: throws TypeError
let result;
try {
  const { x } = undefined;
} catch (e) {
  result = e instanceof TypeError;
}
assert.isTrue(result);

// test: assigns undefined
let { x } = {};

assert.typeOf(x, "undefined");

// test: throws ReferenceError
let result;
try {
  let { [key]: foo } = { z: "bar" };
} catch (e) {
  result = e.type === "NotImplemented";
}
assert.isTrue(result);

// test: does not throw
let {
  d: { e }
} = { d: 2 };
assert.typeOf(e, "undefined");