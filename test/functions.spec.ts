// it: should support RestElement
{
  function f(_a, ...rest) {
    return rest;
  }
  f(1, 2, 3, 4) + "" === [2, 3, 4] + "";
}

// it: should support ObjectPattern
{
  function f({ b: { c } }, { a }) {
    return [a, c];
  }
  [1, 2] + "" === f({ b: { c: 2 } }, { a: 1 }) + "";
}
