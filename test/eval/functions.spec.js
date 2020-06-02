// test: supports RestElement
function fun(_a, ...rest) {
  return rest;
}
assert.deepEqual(fun(1, 2, 3, 4), [2, 3, 4]);

// test: supports ObjectPattern
function fun2({ b: { c } }, { a }) {
  return [a, c];
}
assert.deepEqual([1, 2], fun2({ b: { c: 2 } }, { a: 1 }));
