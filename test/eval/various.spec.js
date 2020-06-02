// test: throws correctly
let thrown = false;
try {
  throw new Error();
} catch (e) {
  thrown = true;
}
assert.isTrue(thrown);

// test: throws primitive value correctly
let thrown = false;
try {
  throw 1;
} catch (e) {
  thrown = true;
}
assert.isTrue(thrown);

// test: supports while statement, :skip
let c = 10;
while (c-- > 0) {}
assert.equal(c, 1);

// test: writes and reads variables
let c = { a: 1 };
c.a = 2;
assert.equal(c.a, 2);
