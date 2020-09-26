// test: switch statement
const x = "a";
let result = 0;
switch (x) {
  case "a":
    result++;
    break;
}
assert.equal(result, 1);

// test: switch statement default case
const x = "a";
let result = 0;
switch (x) {
  case "_":
    result++;
    break;
  default:
    result = 2;
    break;
}
assert.equal(result, 2);

// test: switch statement fall-through case
const x = "a";
let result = 0;
switch (x) {
  case "a":
    result++;
  case "b":
    result++;
    break;
  case "c":
    result++;
    break;
}
assert.equal(result, 2);

// test: switch statement omits unmatched cases
const x = "a";
let result = 0;
switch (x) {
  case "a":
  case "b":
  case "c":
    result++;
    break;
}
assert.equal(result, 1);
