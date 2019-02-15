// it: should not throw in `typeof`
// @ts-ignore
typeof a === 'undefined';

// it: should throw in `typeof` at member expression
{
  let error;
  try {
    // @ts-ignore
    typeof a.b;
  } catch (e) {
    error = e;
  }
  error instanceof ReferenceError;
}

// it: should delete variable from global environment
{
  var z;
  // @ts-ignore
  delete z;
  typeof z === "undefined";
}
