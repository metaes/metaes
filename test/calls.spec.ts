// it: should support MemberExpression
{
  let o = {
    method() {
      return 44;
    },
  };

  o.method() === 44;
}

// it: should support Identifier
{
  function f() {
    return 44;
  }
  f() === 44;
}

// it: should support FunctionExpression
(function() {
  return 44;
})() === 44;

// it: should support CallExpression
{
  function f2() {
    return function() {
      return 44;
    };
  }
  f2()() === 44;
}

// it: should support ArrowFunctionExpression
{
  let fn = () => 44;
  fn() === 44;
}
