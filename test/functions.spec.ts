// it: should support RestElement
{
  function f(_a, ...rest) {
    return rest;
  }
  f(1, 2, 3, 4) + "" === [2, 3, 4] + "";
}

// it: :skip should support ObjectPattern
{
  function f({ a }) {
    return a;
  }
  f({ a: 1 }) === 1;
}
