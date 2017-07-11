// should support MemberExpression
{
  let o = {
    method() {
      return 44;
    },
  };

  o.method() === 44;
}

// should support Identifier
{
  let fn = () => 44;
  fn() === 44;
}
