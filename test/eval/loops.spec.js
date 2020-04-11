// test: loops over values with long array
const input = Array.from(Array(10000).keys());
const output = [];
for (let o of input) {
  output.push(o);
}

assert.deepEqual(input, output);

// test: correctly throws from loop
const input = [1, 2, 3];
let result = false;
try {
  for (let _ of input) {
    throw "error";
  }
} catch (e) {
  result = true;
}
assert.isTrue(result);

// test: supports standard for loop
const result = [];
for (let i = 0; i < 3; i++) {
  result.push(i);
}
assert.deepEqual(result, [0, 1, 2]);
