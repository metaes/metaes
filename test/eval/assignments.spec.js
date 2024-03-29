// test: assigns to computed value
let o = {};
let key = 1;
o[key] = true;
assert.isTrue(o[key]);

// test: throws on assigning to non existent variable (strict mode on default)
let error;
try {
  x = 2;
} catch (e) {
  error = e;
}
assert.instanceOf(error, ReferenceError);

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
  result = e;
}
assert.instanceOf(result, TypeError);

// test: assigns undefined
let { x } = {};

assert.typeOf(x, "undefined");

// test: throws ReferenceError
let result;
try {
  let { [key]: foo } = { z: "bar" };
} catch (e) {
  result = e;
}
assert.equal(result.message, "Computed property in ObjectPattern is not supported yet.");

// test: does not throw
let {
  d: { e }
} = { d: 2 };
assert.typeOf(e, "undefined");

// test: array pattern
let [a, b, ...c] = [1, 2, 3, 4];
assert.deepEqual([a, b, c], [1, 2, [3, 4]]);

// test: array pattern - holes
let [a, b, ...c] = [1];
assert.deepEqual([a, b, c], [1, undefined, []]);

// test: supports update assignment with identifier on left side
let a = 2;
a += 2;
assert.equal(a, 4);

// test: supports update assignment with member expression on left side
let a = { b: 2 };
a.b += 2;
assert.equal(a.b, 4);
