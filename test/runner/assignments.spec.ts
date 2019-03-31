// it: should assign to computed value
{
  let o = {};
  let key = 1;
  o[key] = true;
  o[key] === true;
}

// it: should throw on assigning to non existent variable (strict mode on default)
{
  let caught;
  try {
    // @ts-ignore
    aGlobalVariable = 2;
  } catch (e) {
    caught = e instanceof ReferenceError;
  }
  caught;
}
