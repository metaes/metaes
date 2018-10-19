// it: should support destruction assignment
{
  let { a, b } = { a: 1, b: 2 };
  a == 1 && b === 2;
}
