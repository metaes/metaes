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

// test: supports AssignmentPattern param
function f(a = "test") {
  return a;
}
assert.equal(f(), "test");
assert.equal(f(44), 44);

// test: supports call from host function
assert.deepEqual(
  [1, 2].filter((d) => d > 1),
  [2]
);

// test: passes named function expression name to function body
let result = 0;
(function loop(i) {
  result++;
  if (i > 1) {
    loop(i - 1);
  }
})(10);
assert.equal(result, 10);
