// it: should assign default value
{
  let { d = 3 } = {};
  d === 3;
}

// it: should support destruction assignment
{
  let { a, b = 3, c = 4 } = { a: 1, b: 2 };
  a == 1 && b === 2 && c === 4;
}
