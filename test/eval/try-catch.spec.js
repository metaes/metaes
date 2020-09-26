// test: catches error in return statement
function a() {
  throw "error";
}
function b() {
  return a();
}
let error;
try {
  b();
} catch (e) {
  error = e;
}
assert.equal(error, "error");

// test: return from function with try/catch block
function a() {
  return 44;
}
function b() {
  try {
    return a();
  } catch (e) {
    return "shouldn't get here";
  }
}
assert.equal(b(), 44);
