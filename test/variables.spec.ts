// it: should return string value
typeof "2" === "string";

// it: should return string value from variable
{
  let x = "2";
  typeof x === "string" && x === "2";
}

// it: should return number value
typeof 44 === "number";

// it: should return number value from variable
{
  let x = 44;
  typeof x === "number" && x === 44;
}

// it: should return boolean
typeof true === "boolean";

// it: should return boolean value from variable
{
  let x = false;
  typeof x === "boolean" && x === false;
}

// it: should handle template literal
typeof `42` === "string";

// it: should throw at member expression
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
