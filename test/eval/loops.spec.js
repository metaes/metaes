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

// test: supports for of loop
const result = [];
for (let i of [1, 2, 3]) {
  result.push(i);
}
assert.deepEqual(result, [1, 2, 3]);

// test: for of loop with value destruction
const result = [];
for (let { a } of [{ a: 1 }, { a: 2 }]) {
  results.push(a);
}
assert.deepEqual(results, [1, 2]);

// test: supports do-while
let test = 10;
let counter = 0;
do {
  counter++;
} while (test--);
assert.equal(counter, 11);
