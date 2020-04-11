// test: single named export
export function function1() {}

assert.hasAllKeys(callcc(getExports), ["function1"]);
