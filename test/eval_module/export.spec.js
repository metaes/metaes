// test: single named export
export function function1() {}

assert.hasAllKeys(callcc(getExports), ["function1"]);

// test: single VariableDeclaration export
export const value = 2;

assert.hasAllKeys(callcc(getExports), ["value"]);
