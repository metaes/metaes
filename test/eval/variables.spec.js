// test: returns string value
assert.equal(typeof "2", "string");

// test: returns string value from variable
let x = "2";
assert.equal(typeof x, "string");
assert.equal(x, "2");

// test: returns number value
assert.equal(typeof 44, "number");

// test: returns number value from variable
let x = 44;
assert.equal(typeof x, "number");
assert.equal(x, 44);

// test: returns boolean
assert.equal(typeof true, "boolean");

// test: returns boolean value from variable
let x = false;
assert.equal(typeof x, "boolean");
assert.equal(x, false);

// test: handles template literal
assert.equal(typeof `42`, "string");
