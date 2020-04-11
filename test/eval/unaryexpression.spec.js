// test: does not throw in `typeof`
assert.equal(typeof a, "undefined");

// test: throws in `typeof` at member expression
let error;
try {
  typeof a.b;
} catch (e) {
  error = e;
}
assert.instanceOf(error, ReferenceError);

// test: deletes variable from global environment
var z;
delete z;
assert.equal(typeof z, "undefined");
