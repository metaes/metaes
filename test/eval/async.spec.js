// test: supports await
(async function f() {
  assert.equal(await 2, 2);
})();
