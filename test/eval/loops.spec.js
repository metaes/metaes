// test: loops over values with longer array
const input = Array.from(Array(100).keys());
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

// test: for of loop with simple assignment
const results = [];
let a;
for (a of [1, 2]) {
  results.push(a);
}
assert.deepEqual(results, [1, 2]);

// test: for of loop with value destruction
const results = [];
for (let { a } of [{ a: 1 }, { a: 2 }]) {
  results.push(a);
}
assert.deepEqual(results, [1, 2]);

// test: for of loop with value destruction and default value
const results = [];
for (let { a = "default" } of [{}, {}]) {
  results.push(a);
}
assert.deepEqual(results, ["default", "default"]);

// test: supports do-while
let test = 10;
let counter = 0;
do {
  counter++;
} while (test--);
assert.equal(counter, 11);

// test: supports do-while break
let i = 1;
do {
  if (i === 5) {
    break;
  }
} while (i++);
assert.equal(i, 5);

// test: variable declarator in for-in loop
const result = [];
for (let i in { a: 1, b: 2, c: 3 }) {
  result.push(i);
}
assert.deepEqual(result, ["a", "b", "c"]);
