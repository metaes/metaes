// test: declares a class
class C {}
assert.typeOf(C, "function");

// test: class constructor
class Container {
  constructor(value) {
    this.value = value;
  }
}
assert.equal(new Container("test").value, "test");

// test: class method
class Container {
  constructor(value) {
    this.value = value;
  }
  getValue() {
    return this.value;
  }
}
assert.equal(new Container("test").getValue(), "test");
