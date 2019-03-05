// it: should support RestElement
{
  function fun(_a, ...rest) {
    return rest;
  }
  fun(1, 2, 3, 4) + "" === [2, 3, 4] + "";
}

// it: should support ObjectPattern
{
  function fun2({ b: { c } }, { a }) {
    return [a, c];
  }
  [1, 2] + "" === fun2({ b: { c: 2 } }, { a: 1 }) + "";
}
