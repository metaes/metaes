// test: assigns to computed value
let o = {};
let key = 1;
o[key] = true;
assert.isTrue(o[key]);

// test: throws on assigning to non existent variable (strict mode on default)
let caught;
try {
  aGlobalVariable = 2;
} catch (e) {
  caught = e instanceof ReferenceError;
}
assert.isTrue(caught);
