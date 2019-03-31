// it: should throw correctly
{
  let thrown = false;
  try {
    throw new Error();
  } catch (e) {
    thrown = true;
  }
  thrown;
}

// it: should throw primitive value correctly
{
  let thrown = false;
  try {
    throw 1;
  } catch (e) {
    thrown = true;
  }
  thrown;
}

// it: should support while statement, :skip
{
  let c = 10;
  while (c-- > 0) {}
  c;
}

// it: should write and read variables
{
  let c = { a: 1 };
  c.a = 2;
  c.a === 2;
}
