// it: should support destruction assignment
{
  let { a, b = 3, c = 4 } = { a: 1, b: 2 };
  console.log(callcc(getThisEnv));
  a == 1 && b === 2 && c === 4;
}
