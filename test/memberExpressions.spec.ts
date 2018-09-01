// it: should support not computed Identifier property
{
  let a = { b: 44 };
  a.b === 44;
}

// it: should support computed Identifier and Literal property
{
  let a = { b: 44 };
  let c = { d: 44 };
  let d = "d";
  a["b"] === 44 && c[d] === 44;
}

// it: should throw on undefined object
{
  let a = { b: null };
  let result;
  try {
    // @ts-ignore
    a.b.c;
  } catch (e) {
    result = e instanceof TypeError;
  }
  result;
}

// it: should throw on undefined object in computed property
{
  let a = { b: null };
  let result;
  let c = "anything";
  try {
    // @ts-ignore
    a.b[c];
  } catch (e) {
    result = e instanceof TypeError;
  }
  result;
}
