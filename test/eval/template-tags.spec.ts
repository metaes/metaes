// it: should call a function
{
  function fn(value) {
    return value;
  }
  fn`test` === "test";
}
