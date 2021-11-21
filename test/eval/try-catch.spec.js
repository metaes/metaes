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

// test: runs finally even if catch block throws again
let called = false;
try {
  try {
    throw "error";
  } catch (e) {
    throw e;
  } finally {
    called = true;
  }
} catch (e) {}
assert.equal(called, true);

// test: supports catch block without argument
let called = false;
try {
  throw 1;
} catch {
  called = true;
}
assert.equal(called, true);
