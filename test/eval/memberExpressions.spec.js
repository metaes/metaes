// test: supports not computed Identifier property
let a = { b: 44 };
assert.equal(a.b, 44);

// test: supports computed Identifier and Literal property
let a = { b: 44 };
let c = { d: 44 };
let d = "d";
assert.equal(a["b"], 44);
assert.equal(c[d], 44);

// test: throws on undefined object
let a = { b: null };
let result;
try {
  a.b.c;
} catch (e) {
  result = e instanceof TypeError;
}
assert.isTrue(result);

// test: throws on undefined object in computed property
let a = { b: null };
let result;
let c = "anything";
try {
  a.b[c];
} catch (e) {
  result = e instanceof TypeError;
}
assert.isTrue(result);
