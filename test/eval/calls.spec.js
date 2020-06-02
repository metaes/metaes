// test: supports MemberExpression
let o = {
  method() {
    return 44;
  }
};

assert.equal(o.method(), 44);

// test: supports Identifier
function f2() {
  return 44;
}
assert.equal(f2(), 44);

// test: supports FunctionExpression
assert.equal(
  (function () {
    return 44;
  })(),
  44
);

// test: supports CallExpression
function f3() {
  return function () {
    return 44;
  };
}
assert.equal(f3()(), 44);

// test: supports ArrowFunctionExpression
let fn = () => 44;
assert.equal(fn(), 44);

// test: supports SpreadExpression
let array = [];
array.push(...[1, 2, 3]);
assert.deepEqual(array, [1, 2, 3]);

// test: throws an error (:skip)
let e;
try {
  [].push(...1);
} catch (_e) {
  e = e;
}
assert.instanceOf(e, TypeError);
assert.equal(e.message, "Found non-callable @@iterator");
