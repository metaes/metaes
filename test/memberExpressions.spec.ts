// it: should support not computed Identifier property
{
  let a = { b: 44 };
  a.b === 44;
}

// it: should support computed Identifier and Literal property
{
  let a = { b: 44 };
  let c = { d: 44 };
  let d = 'd';
  a['b'] === 44 && c[d] === 44;
}