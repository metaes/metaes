// test: single named export :skip
export function function1() {}

assert.hasAllKeys(callcc(getExports), ["function1"]);

// test: single VariableDeclaration export :skip
export const value = 2;

assert.hasAllKeys(callcc(getExports), ["value"]);
