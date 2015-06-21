# MetaES

MetaES is a metacircular interpreter (http://en.wikipedia.org/wiki/Meta-circular_evaluator) written in JavaScript at EcmaScript 5.1 standard, so it can be run on any environment that supports ES5.1, for example modern browsers (both with mobile), nodejs, rhino, nashorn and other ECMAScript 5.1 interpreters.

MetaES is currently in an alpha state.

## Links

 * You can see live and editable examples on MetaES [Playground](http://metaes.org).
 * MetaES was tested using [test262](http://test262.ecmascript.org/) test suite. Runnable test suite is currently not added to the repository.
 * for code parsing MetaES uses [esprima](http://esprima.org).

## Contribute

 * You can report [issues and bugs](https://github.com/metaes/metaes/issues).
 * Help with implementation of new features using [pull requests](https://github.com/metaes/metaes/pulls).

## Installation

### Using `npm`:

    npm install git+git@github.com:metaes/metaes.git
    
Then write in a `.js` file:

```js
var metaes = require('metaes');

function interceptor(e, val, env, pause) {
  console.log('[' + e.type + ']', e.subProgram, val);
}

var
  c = 1,
  map = function (x) {
    return x * x * c;
  },
  metacircularMap = metaes.evaluate(map, {c: 10}, {interceptor: interceptor});

// see the results
console.log("map:", [1, 2, 3, 4, 5].map(map));
console.log("metacircular map:", [1, 2, 3, 4, 5].map(metacircularMap));
```

to see the output in the console.
   
### Using `bower`:

    bower install git@github.com:metaes/metaes.git
    
Then import the script:

```html
<script src="bower_components/esprima/esprima.js"></script>
<script src="bower_components/metaes/metaes.js"></script>
```

and then you can write:

```js
metaes.evaluate('console.log("hello world!")', window);
```
    
## Documentation

Read API docs at [2. API Reference](https://github.com/metaes/metaes#2-api-reference)

## License

    The MIT License (MIT)
    
# Table of contents

1. [About MetaES as a metacircular interpreter](https://github.com/metaes/metaes#1-about-metaes-as-a-metacircular-interpreter)
2. [API Reference](https://github.com/metaes/metaes#2-api-reference)
3. [Roadmap](https://github.com/metaes/metaes#3-roadmap)

## 1. About MetaES as a metacircular interpreter

As it was said in the prelude, MetaES is a metacircular interpreter. You can learn more about such interpreter for example in SICP book that is available for free online http://mitpress.mit.edu/sicp/full-text/sicp/book/node76.html

![Picture 1. Gerald Jay Sussman showing how it works from the big picture](https://dsphobby.files.wordpress.com/2009/01/eval-apply-loop.png?w=510)

[Picture 1. Gerald Jay Sussman showing how it works from the big picture]

Metacircular interpreter basically interprets the language that it is written in, but that interpretation process is easier, 
because there is a lot of features implemented in base interpreter. In case of MetaES those features are available in every ECMAScript 5.1 interpreter:

 * binary expression operators, e.g.: `+`, `-`, `*`, `/`,
 * literals (`boolean`, `String`, `Number`, Objects - `{...}`, Arrays - `[...]`),
 * `functions`, internal function `[[Call]]`, `bind`, `apply`, `call`,
 * prototypes – MetaES doesn’t rewrite them,
 * objects creation with `new`, `Object.create`,
 * standard global objects, like `Object`, `Array`, `String`, `Date`

and more.

Therefore, the big part of metacircullar interpretation is just reusing capabilities of original interpreter.
However, MetaES adds some informations available to user, that in normal execution are hidden and possibly available only through the debugger API specific for each engine. 
Those informations are, with examples:

  * access to scope as the JavaScript object:
    
    ```js
    var metaes = require('metaes');

    function interceptor(e, value, env, pause) {
      if (e.type === 'CallExpression' && value && value.callee == getScopeVariablesNames) {
        pause()(Object.keys(env.names));
      }
    }
    
    function getScopeVariablesNames() {
      throw new Error("Direct call is not allowed.")
    }
    
    function fn() {
      var a = "string", b = 2, c = false, d = {};
    
      // let's call the special method constructed for this instance of interpreter.
      console.log(getScopeVariablesNames());
    }
    
    var metaFn = metaes.evaluate(fn, {
        console: console,
        getScopeVariablesNames: getScopeVariablesNames
      },
      {interceptor: interceptor});
    
    metaFn();
    
    // output:
    //  [ 'this', 'fn', 'a', 'b', 'c', 'd' ]
    ```
  * access to the stack as the JavaScript object:
  
    ```js
    var metaes = require('metaes');

    function interceptor(e, value, env, pause) {
      if (e.type === 'CallExpression' && value && value.callee == getStack) {
    
        var stack = [];
        do {
          stack.push(env)
        } while (env = env.prev);
    
        pause()(stack.map(function (env) {
          if (env.fn) {
            return env.fn.e.id.name;
          } else {
            return 'global';
          }
        }));
      }
    }
    
    function getStack() {
      throw new Error("Direct call is not allowed.")
    }
    
    function fn() {
      function a() {
        // let's call the special method constructed for this instance of interpreter.
        console.log(getStack());
      }
    
      function b() {
        a();
      }
    
      function c() {
        b();
      }
    
      c();
    }
    
    var metaFn = metaes.evaluate(fn, {
        console: console,
        getStack: getStack
      },
      {interceptor: interceptor});
    
    metaFn();
    
    // output
    // [ 'a', 'b', 'c', 'fn', 'global' ]
    ```
  * access to functions closures:
  
    ```js
    var metaes = require('metaes');

    function interceptor(e, value, env, pause) {
      if (e.type === 'CallExpression' && value && value.callee == getCurrentFunctionClosure) {
        pause()(Object.keys(env.closure.names));
      }
    }
    
    function getCurrentFunctionClosure() {
      throw new Error("Direct call is not allowed.")
    }
    
    function fn() {
      console.log("outer", getCurrentFunctionClosure());
    
      var a, b, c, d;
      (function () {
        console.log("inner", getCurrentFunctionClosure());
      }());
    }
    
    var metaFn = metaes.evaluate(fn, {
        console: console,
        getCurrentFunctionClosure: getCurrentFunctionClosure
      },
      {interceptor: interceptor});
    
    metaFn();
    
    // outer [ 'console', 'getCurrentFunctionClosure' ]
    // inner [ 'this', 'fn', 'a', 'b', 'c', 'd' ]
    ```
  * stopping/resuming the execution
  
    ```js
    var metaes = require('metaes');
  
    function interceptor(e, value, env, pause) {
      if (e.type === 'CallExpression' && value && value.callee == sleep) {
        var ms = value.arguments[0];
        var resume = pause();
        setTimeout(resume, ms);
      }
    }
    
    function sleep() {
    }
    
    function fn() {
      console.log("before");
      var start = new Date().getTime();
      sleep(1000);
      console.log("after", new Date().getTime() - start + "ms");
    }
    
    var metaFn = metaes.evaluate(fn, {
        console: console,
        sleep: sleep,
        Date: Date
      },
      {interceptor: interceptor});
    
    metaFn();
    
    // before
    // after 1007ms
    ```
  
  * support for ES6 or any future ES version
  
    Projects like Traceur/Babel/es6to5 proved that is it possible to simulate ES6 features in ES5. In case of interpretation that can be even more powerful, because interpreter has a chance to implement new features behind the scenes using previous ones, just like does native interpreter in C++, without adding special wrappers to executed code. So, with little effort there are `ArrowFunctions`
    
    ```js
    [1,2,3].map((x) => {return x*x}) // [1, 4, 9]
    ```
    
   `ArrayComprehension`s (proposed in ES7, but implemented in `esprima#harmony`):
   
   ```js
   [for (let x in [1,2,3]) x*x]; // [1, 4, 9]
   ```
   
   and they are based on `FunctionExpression` and `ForStatement` available in ES5.
   
   `class`, `import`, `export` are easy as well, not mentioning `yield`, that just is based on pausing and resuming execution with preservation of the scope. ES7s `await` may be a subject of implementation as well, if underlaying parser parses it correctly.

Saying again, in short,  MetaES while running may inform about approaching every token with its value, source information (start/stop line/column, index range, parsed AST node value), current callstack, closure and variables in the scope.  

Additional feature or this interpreter is intentional native JavaScript interoperability. Let's go through a list of example possibilities to feel more the concept of metacircullarity:
 * you can call functions generated by MetaES interpreter by those not generated and vice versa,
 * it's even possible to interpret interpreter inside previous instance of interpreter in order to make some more advanced introspections,
 * you can share functions/objects/variables between different instances of MetaES VM and between native JavaScript interpreter,
 * looking from outside the metacircular function is just a function, but inside it uses MetaES to execute its body,
 * you can create metacircular interceptor,
 * you can hook to any evaluation and change its behaviour, for example you can introduce some kind of `Big Numbers` or currencies and interpret them correctly using interceptor. Like `"1USD" + "2USD"` in `BinaryExpression` with `+` operator will give `"3USD"`. Look for an example in Playground,
 * you can inject special functions inside VM and simulate different control flows, like continuations, yielding, coroutines. Go to Playground and see example with ES7 `await`. `pause`/`sleep` shown previously also creates different control structure, 
 * MetaES allows to run most of the application with native speed and slow down only in few important places using metacircular interpretation. For example library code can be run natively, but library client will run in metacircular way,
Nevertheless, it's possible to run everything in MetaES mode having in mind performance penalty.

##  2. API Reference

There are TypeScript typings [available](https://github.com/metaes/metaes/blob/master/metaes.d.ts). You can treat them as complemention of this reference. 

This is the signature of function calling the interpreter in `metaes` object:

```js
function evaluate(text, rootEnvironment, cfg, c, cerr)
```

The parameters are:

  * `text` - JavaScript program source or function reference
  * `rootEnvironment` (optional) - object containing key-value pairs that will be enviroment for the program. I can be for example just `window`/`global`, or `{a: 1, b:2}`, or environment that has previous (outer) environment and that environment that should have following properties:
      * `name` - key-valued object, like previously: `{a: 1, b:2}`
      * `prev` - environment
    
   For example:
    ```js
    var 
      outer = {
        names: window,
        prev: null
      },
      env = {
        names: {foo:"bar"},
        prev: outer
      };
    metaes.evaluate("console.log(foo)", env);
    ```
    or
    ```js
    metaes.evaluate("console.log(foo)", {foo:"bar", console:console});
    ```
  * `cfg` (optional) - object which may contain following properties:
    * `name` - name of the VM, can be filename or just any arbitrary name. Leaving it undefined will by default assign name like VMx where `x` is next natural number. 
    * `interceptor` - function of signature `(e, value, env, pause)` where 
        * `e` - AST node from esprima, 
        * `value` - a JavaScript value 
        *  `env` - enviroment object compatible with extended `rootEnvironment` parameter
        * `pause` - function that once called stops execution of MetaES and returns a function for resuming execution with an argument. More in the examples. 
  * `c` (optional) - function that will be called if evaluation finishes successfully, should have signature
    ```js
    function(ast, value)
    ```
    where the arguments are:
    * `ast` - AST of parsed program
    * `value` - value of the last expression

  * `cerr` (optional) - function that will be called if evaluation finishes with an error (`SyntaxError`, `ReferenceError` of any kind of exception). Function should have a signature:
    
    ```js
    function(ast, errorName, error);
    ```
    
    where the arguments are:
    * `ast` - AST of parsed program
    * `errorName` - can be `Error` which is native error, `SyntaxError` or `ReferenceError`
    * `error` - error object
    
and `evaluate` returns the result of synchronous evaluation. Let's compare it to well know `eval`:

```js
metaes.evaluate("2+x", {x:2}) === eval("2+2") // true
```
or:
```js
metaes.evaluate("var x = 1 + a, x;", {a:1});
```

will return `2` of course, but:

```js
metaes.evaluate("var x = 1 + a, x;");
```

will throw `ReferenceError: a is not defined.`, just like `eval`.

In case you were curious:

```js
metaes.evaluate("eval(1+2)"); // ReferenceError: eval is not defined.
metaes.evaluate("eval(1+2)", {eval:eval}); // 3
eval('metaes.evaluate("eval(1+2)", {eval:eval})'); // 3
```

The most interesting feature is `interceptor`. So you can write

```js
function interceptor(e, value, env, pause) {
    console.log("[" + e.type + "]: " + e.subProgram + " (line:" + e.loc.start.line + ", col: " + e.loc.start.column + ")");
}
var fn = metaes.evaluate(function(x){return x*x}, {}, {interceptor: interceptor});

console.log([1,2,3].map(fn));
```
    
And you'll get in your console:

```js
[ExpressionStatement]: undefined (line:1, col: 0)
VM1331:3 [FunctionExpression]: undefined (line:1, col: 1)
VM1331:3 [FunctionExpression]: function (x){return x*x} (line:1, col: 1)
VM1331:3 [ExpressionStatement]: (function (x){return x*x}) (line:1, col: 0)
VM1331:3 [Identifier]: undefined (line:1, col: 11)
VM1331:3 [BlockStatement]: undefined (line:1, col: 13)
VM1331:3 [ReturnStatement]: undefined (line:1, col: 14)
VM1331:3 [BinaryExpression]: undefined (line:1, col: 21)
VM1331:3 [Identifier]: undefined (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 21)
VM1331:3 [Identifier]: undefined (line:1, col: 23)
VM1331:3 [Identifier]: x (line:1, col: 23)
VM1331:3 [BinaryExpression]: x*x (line:1, col: 21)
VM1331:3 [ReturnStatement]: return x*x (line:1, col: 14)
VM1331:3 [FunctionExpression]: function (x){return x*x} (line:1, col: 1)
VM1331:3 [Identifier]: undefined (line:1, col: 11)
VM1331:3 [BlockStatement]: {return x*x} (line:1, col: 13)
VM1331:3 [ReturnStatement]: return x*x (line:1, col: 14)
VM1331:3 [BinaryExpression]: x*x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 23)
VM1331:3 [Identifier]: x (line:1, col: 23)
VM1331:3 [BinaryExpression]: x*x (line:1, col: 21)
VM1331:3 [ReturnStatement]: return x*x (line:1, col: 14)
VM1331:3 [FunctionExpression]: function (x){return x*x} (line:1, col: 1)
VM1331:3 [Identifier]: undefined (line:1, col: 11)
VM1331:3 [BlockStatement]: {return x*x} (line:1, col: 13)
VM1331:3 [ReturnStatement]: return x*x (line:1, col: 14)
VM1331:3 [BinaryExpression]: x*x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 21)
VM1331:3 [Identifier]: x (line:1, col: 23)
VM1331:3 [Identifier]: x (line:1, col: 23)
VM1331:3 [BinaryExpression]: x*x (line:1, col: 21)
VM1331:3 [ReturnStatement]: return x*x (line:1, col: 14)
VM1331:3 [FunctionExpression]: function (x){return x*x} (line:1, col: 1)
VM1331:7 [1, 4, 9]
```

Calling metacircular function is in fact this:

```js
>> Function.prototype.toString.call(fn);
// outputs
>> "function (x) {return MetaInvokerInner.apply(this,arguments)}"
```

## 3. Roadmap

MetaES is still in experimental mode and alpha state, therefore there is couple of goals to accomplish:

  * clean up the source code and update internal naming to match official ECMAScript reference
  * finish implementation of ES6 and create a room for experiments with ES7 and further versions
  * create CI system with tests262 tests suite
  * rewrite source code to TypeScript and implement source maps 