// should throw correctly
{
  let thrown = false;
  try {
    throw new Error();
  } catch (e) {
    thrown = true;
  }
  thrown;
}

// should throw primitive value correctly
{
  let thrown = false;
  try {
    throw 1;
  } catch (e) {
    thrown = true;
  }
  thrown;
}

// should support while statement, :skip
{
  let c = 10;
  while (c-- > 0) {}
  c;
}

// should write and read variables
{
  let c = { a: 1 };
  c.a = 2;
  c.a === 2;
}
