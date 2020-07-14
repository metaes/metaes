// test: spread in array expression
assert.deepEqual([1, ...[2], ...3, ...[4]], [1, 2, 3, 4]);
