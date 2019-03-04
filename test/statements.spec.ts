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

// it: should support deeper destruction assignment
{
  let called = false;
  function foo() {
    called = true;
    return 4;
  }
  let {
    a,
    b: { c = foo() }
  } = { a: 1, b: { c: 2 } };

  a == 1 && c === 2 && called === false;
}

// it: should throw TypeError
{
  let result;
  try {
    // @ts-ignore
    const { x } = undefined;
  } catch (e) {
    result = e instanceof TypeError;
  }
  result;
}
