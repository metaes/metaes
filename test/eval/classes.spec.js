// test: ignores returned primitive value
function ctor() {
  return 2;
}
assert.typeOf(new ctor(), "object");

// test: returns newly created instance
function ctor() {
  this.x = 2;
}
assert.typeOf(new ctor(), "object");
assert.equal(new ctor().x, 2);

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

// test: super class super() call
class Base {
  constructor(value) {
    this.value = value;
  }
}

class Derived extends Base {
  constructor(value) {
    super(value);
  }
}

assert.equal(new Derived("test").value, "test");

// test: supports class expressions
const klass = class Foo {
  foo() {
    return "bar";
  }
};

assert.equal(typeof Foo, "undefined");
assert.equal(new klass().foo(), "bar");
