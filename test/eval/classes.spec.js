// test: supports this value
function ctor() {
  return 2;
}
assert.typeOf(new ctor(), "object");

// test: declares a class
class C {}
assert.typeOf(C, "function");

// test: class constructor
class Container {
  constructor(value) {
    this.value = value;
  }
}

assert.typeOf(Container, "function");
assert.typeOf(new Container(), "object");
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

// test: super class
class Base {
  getValue() {
    return this.value;
  }
}
class Container extends Base {
  constructor(value) {
    this.value = value;
  }
}
assert.equal(new Container("test").getValue(), "test");
