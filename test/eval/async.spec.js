// test: supports await
(async function () {
  assert.equal(await 2, 2);
})();

// test: supports async function returns
(async function () {
  const f1 = (x) => new Promise((resolve) => resolve(x * 2));
  async function f2(x) {
    return await f1(x);
  }
  assert.equal(await f2(22), 44);
})();

// test: supports async function errors
(async function () {
  async function raise() {
    throw new Error("error");
  }
  let e;
  try {
    await raise();
  } catch (_e) {
    e = _e;
  }
  assert.equal(e.message, "error");
  assert.instanceOf(e, Error);
})();
