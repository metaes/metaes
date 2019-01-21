<main>

# MetaES docs

## About MetaES as a metacircular interpreter

MetaES is a ECMAScript metacircular interpreter. You can learn more about such interpreter for example in SICP book that is available for free online https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book.html

Metacircular interpreter basically interprets the language that it is written in, but that interpretation process is easier, because there is a lot of features implemented in base interpreter. In case of MetaES those features are available in every ECMAScript 5.1+ interpreter, for example:

-   operators like `+`, `-`, `*`, `/`,
-   literals parsing: `boolean`, `String`, `Number`, Objects - `{...}`, Arrays - `[...]` etc,
-   functions support (with closures), internal function calling - `[[Call]]`, function methods - `bind`, `apply`, `call` etc,
-   prototypes – MetaES doesn’t rewrite them,
-   objects creation with `new`, `Object.create`,
-   standard global objects, like `Object`, `Array`, `String`, `Date` etc.

Therefore, the big part of metacircullar interpretation is just reusing capabilities of original interpreter.
However, MetaES adds some informations available to user, that in normal execution are hidden and possibly available only through the debugger API specific for each engine or non-standard functions.

## Using MetaES

It's highly recommended to read [Deeper understanding of MetaES](#) first. That will make reading this manual way easier. You can skip it if you just want to use MetaES in a basic way.

### Before beginning

We need to understand one thing outside of MetaES business - parsing and ASTs - Abstract Syntax Trees.

Let's say we have a function `parse` that accepts string and returns AST object:

```javascript
parse('2+2');

// returns
{
    "type": "Program",
    "body": [
        {
            "type": "ExpressionStatement",
            "expression": {
                "type": "BinaryExpression",
                "operator": "+",
                "left": {
                    "type": "Literal",
                    "value": 2,
                    "raw": "2"
                },
                "right": {
                    "type": "Literal",
                    "value": 2,
                    "raw": "2"
                }
            }
        }
    ],
    "sourceType": "script"
}
```

AST represents code in a structure that can be evaluated, compiled, transformed etc. - you name it.
Currently used parser is Esprima. For MetaES it doesn't matter as long produced AST is of the same shape. Ideally, `parse` function would be provided by the browser or host environment where MetaES is run.

Going a bit ahead, here's one interesting fact: you can get along without parser at all, as long you want to talk to MetaES using ASTs.

### Basic evaluation

In simplest case you can just write:

```js
metaesEval("2+2", console.log);
```

which will eval to `4` - a success value. You need to provide success callback as 2nd parameter.

Errors are suported in second callback:

```js
metaesEval("x", null, console.error);
```

This code will throw an error and error will be logged to the console.

You can omit success and error callback entirely - `metaesEval('doAnythingCorrect()')` - but you won't get back the result.

You can run this way any code:

```javascript
let anyLongCode = `
    let input = [1,2,3];
    let squared = input.map(x=>x*x);`;
metaesEval(anyLongCode, console.log);
```

that parses. Otherwise:

```javascript
metaesEval(`1x`, null, console.error);
```

will throw parse error.

Remember that:

```javascript
metaesEval("throw 1");
```

will not throw. You have to provide error callback. It can throw only if error happens internally in MetaES.

You can also run AST directly:

```javascript
metaesEval(
    {
        type: "BinaryExpression",
        operator: "+",
        left: {
            type: "Literal",
            value: 2,
            raw: "2"
        },
        right: {
            type: "Literal",
            value: 2,
            raw: "2"
        }
    },
    console.log
); // 4
```

That way MetaES won't need to parse source. Downside is there's no AST validator - a JavaScript parser was validating incorrect programs.
MetaES doesn't check AST correctness too.

The last bit to explain on this stage is evaluation of functions:

```javascript
metaesEval(function(x) {
    return x * x;
}, console.log);
```

Result is a function. Metacircular function. When called, it runs MetaES previously parsed its stringified sources.

```javascript
let fn;
metaesEval(
    function(x) {
        return x * x;
    },
    result => (fn = result)
);
fn(2); // 4;
```

But, it's not a full featured function - as is function in native interpterer - metacircular function doesn't support closures. You'll have to construct closure by yourself. We'll come back to that later.
All in all, that's very convenient way to run MetaES code without playing with `environment`.

### Environment

MetaES allows easy interaction with host environment.
Host environment is just interpreter environment that is used to run MetaES.

For example:

```javascript
let user = { name: "User1" };
metaesEval(`user.name="User2"`, console.log, console.error, { user });
console.log(user);
```

At the end `user.name` will be equal to `User2`, because this is how it was changed in MetaES.

However, if you try to access another variable:

```javascript
let user = { name: "User1" };
let user2 = { name: "User2" };
metaesEval(`user2.name="User2"`, console.log, console.error, { user, user3 });
```

It will throw a `ReferenceError`.
Environments can have any number of properties.

Those were examples of shortcut object environment, which internally were converted to regular environments.
Regular environment consists of two fields: `values` (shortcut values go here) and `prev`, which contains reference to outer environment. `prev` is optional. It works similarly to prototypical inheritance in ECMAScript.

Let's see:

```javascript
let environment = { values: { a: 1 } };
metaesEval("a*2", console.log, console.error, environment);
```

You may want to create environments chain and MetaES does it anyway the same way as JavaScript does:

```javascript
let environment0 = { values: { b: 2 } };
let environment = { values: { a: 1 }, prev: environment0 };
metaesEval("a*b", console.log, console.error, environment);
```

MetaES will recursively look for variables until `prev` field exists. Environment without `prev` is a global environment.
If variable is not found, it will throw.

Variables shadowing works as expected.
Try to play with values of `environment0` and `environment` and shadow `b` variable from `environment0`.

We're ready to understand how to support closures for metacircular functions.

Going back to the previous example and improving it a bit:

```javascript
let fn;
let b = 3;
metaesEval(
    function(x) {
        return x * x * b;
    },
    result => (fn = result),
    console.error
);
fn(2); // ReferenceError: "b" is not defined
```

`b` is there defined on line 2. But is not visible for metacircular function.

Remember that function was stringified using its `.toString()`. `b` in closure can be fixed in a following manual way:

```javascript
let fn;
let b = 3;
metaesEval(
    function(x) {
        return x * x * b;
    },
    result => (fn = result),
    console.error,
    { b }
);
fn(2); // 12
```

Now `b` belongs to `fn` closure, because it was there at the time of function creation.

Trying to cheat environment and adding `b` on-the-fly doesn't work:

```javascript
let fn;
let b = 3;
metaesEval(
    function(x) {
        return x * x * b;
    },
    result => (fn = result),
    console.error
);

metaesEval(
    // [1]
    `fn(2)`,
    console.log,
    console.error,
    { fn, b }
);
```

This is because MetaES and JavaScript support static variable binding, not dynamic.
It means variables in environment do not flow down to the function. If variables weren't seen in environments chain during _creation_ of function, they're not available in function body during _execution_.

Another interesting thing is you can pass around metacircular MetaES functions as if there were normal functions. Because they are on the surface. That happened in `[1]`.

```javascript
typeof fn === "function"; // true
```

There is hacky way to add missing `b` to closure:

```javascript
let fn;
let b = 3;
metaesEval(
    function(x) {
        return x * x * b;
    },
    result => (fn = result)
);
fn.__meta__.closure.values.b = b;
fn(2);
```

Conceptually it's similar to non-standard `__proto__` in JavaScript engines.

On top of `metaesEval` function there are created utility functions, like `evalToPromise`, `evalFunctionBody`, `evaluateFunction` etc. Go ahead to the [MetaES](https://github.com/metaes/metaes/blob/master/lib/metaes.ts) GitHub repository and explore.

### Interceptor

Onto the last but not least argument of `metaesEval` - `config`.
`config` is a configuration object, not a single value.
Provided `config` will be passed around during execution of given script inside MetaES, until the execution ends.
It may contain many things, but only one is the most important - interceptor.

Think of an interceptor as a function that is called every time MetaES enters or exits AST node.
It's a basic building block for many MetaES use cases.

Example:

```js
let start = new Date().getTime();
let padding = 0;
let source = "a+2";
metaesEval(
    source,
    console.log, // 4
    console.error,
    { values: { a: 2 } },
    {
        interceptor({ phase, timestamp, e, value, config }) {
            if (phase === "exit") {
                padding--;
            }
            console.log(
                `[${timestamp - start}ms] script${config.script.scriptId}:${
                    e.loc ? e.loc.start.line + "," + e.loc.start.column : "*"
                }`,
                "\t",
                " ".repeat(padding),
                e.type,
                e.range ? `"${source.substring(e.range[0], e.range[1])}"` : "",
                `(${value})`
            );
            if (phase === "enter") {
                padding++;
            }
        }
    }
);
```

will output:

```
1ms enter Program
1ms enter ExpressionStatement
1ms enter BinaryExpression
2ms enter Identifier
2ms enter GetValue
2ms exit GetValue
3ms exit Identifier
3ms enter Literal
4ms exit Literal
5ms exit BinaryExpression
5ms exit ExpressionStatement
6ms exit Program
```

That kind of log is useful for all sorts of instrumentation tools. Already it's easy to see that `enter`/`exit` phases create tree structure, let's try to visualize it better and add some more metadata:

```javascript
let start = new Date().getTime();
let padding = 0;
let source = `var a = 2;
var b = 3;
b+a;`;
metaesEval(
    source,
    console.log, // 4
    console.error,
    { values: { a: 2 } },
    {
        interceptor({ phase, timestamp, e, value, config }) {
            if (phase === "exit") {
                padding--;
            }
            console.log(
                `[${timestamp - start}ms] script${config.script.scriptId}:${
                    e.loc ? e.loc.start.line + "," + e.loc.start.column : "*"
                }`,
                "\t",
                " ".repeat(padding),
                `${phase === "enter" ? "↓" : "↑"}${e.type}:`,
                e.range ? `"${source.substring(e.range[0], e.range[1]).replace(/\n/g, "\\n")}"` : "",
                `=> ${value}`
            );
            if (phase === "enter") {
                padding++;
            }
        }
    }
);
```

Output is more verbose:

```
[8ms] script0:1,0 	  ↓Program: "var a = 2;\nvar b = 3;\nb+a;" => undefined
[12ms] script0:1,0 	   ↓VariableDeclaration: "var a = 2;" => undefined
[12ms] script0:1,4 	    ↓VariableDeclarator: "a = 2" => undefined
[13ms] script0:1,8 	     ↓Literal: "2" => undefined
[13ms] script0:1,8 	     ↑Literal: "2" => 2
[13ms] script0:* 	     ↓SetValue:  => undefined
[13ms] script0:* 	     ↑SetValue:  => 2
[13ms] script0:1,4 	    ↑VariableDeclarator: "a = 2" => 2
[13ms] script0:1,0 	   ↑VariableDeclaration: "var a = 2;" => 2
[14ms] script0:2,0 	   ↓VariableDeclaration: "var b = 3;" => undefined
[14ms] script0:2,4 	    ↓VariableDeclarator: "b = 3" => undefined
[14ms] script0:2,8 	     ↓Literal: "3" => undefined
[14ms] script0:2,8 	     ↑Literal: "3" => 3
[14ms] script0:* 	     ↓SetValue:  => undefined
[14ms] script0:* 	     ↑SetValue:  => 3
[14ms] script0:2,4 	    ↑VariableDeclarator: "b = 3" => 3
[14ms] script0:2,0 	   ↑VariableDeclaration: "var b = 3;" => 3
[14ms] script0:3,0 	   ↓ExpressionStatement: "b+a;" => undefined
[14ms] script0:3,0 	    ↓BinaryExpression: "b+a" => undefined
[15ms] script0:3,0 	     ↓Identifier: "b" => undefined
[15ms] script0:* 	      ↓GetValue:  => undefined
[15ms] script0:* 	      ↑GetValue:  => 3
[15ms] script0:3,0 	     ↑Identifier: "b" => 3
[15ms] script0:3,2 	     ↓Identifier: "a" => undefined
[15ms] script0:* 	      ↓GetValue:  => undefined
[15ms] script0:* 	      ↑GetValue:  => 2
[15ms] script0:3,2 	     ↑Identifier: "a" => 2
[15ms] script0:3,0 	    ↑BinaryExpression: "b+a" => 5
[16ms] script0:3,0 	   ↑ExpressionStatement: "b+a;" => 5
[16ms] script0:1,0 	  ↑Program: "var a = 2;\nvar b = 3;\nb+a;" => 5
```

This way of using interceptor is a base for flame graph building and creating context that can be observed.

It's time to go to other `config` field - `intepreters`.

### Interpreters

If you are after [Deeper understanding of MetaES](#), it will be an easy part. Normally you run `metaES` eval like that:

```javascript
metaesEval("2+a", console.log, console.error); // Error
```

Already we know, to fix missing `a` you can just provide an environment:

```javascript
metaesEval("2+a", console.log, console.error, { a: 2 }); // 4
```

But what if we want to delay `a` dereferencing util `a` is hit in the runtime? We'd want use custom `Identifier` interpreter, meaning we want to tell MetaES how to resolve variables. Maybe that interpreter would reach over HTTP, WebSocket etc. and that would take uknown amount of time? It can be done with rewriting of `interpreters` field:

```javascript
const interpreters = {
    prev: ECMAScriptInterpreters,
    values: {
        Identifier(e, c, cerr) {
            c(44);
        }
    }
};
metaesEval("var b=3; 2+a+b", console.log, console.error, { a: 2 }, { interpreters }); // 90
```

Few things to note:

-   `interpreters` is an `environment`
-   `interpreters` environment has to reference at some point an outer environment which is `ECMAScriptInterpreters`. This environment is provided by MetaES itself and contains interpreters to interpret ECMAScript nodes. Otherwise MetaES will just throw `NotImplementedException`.
-   we actually broke `Indentifier` - it always returns 44, even if variable _is_ defined.

Let's fix it:

```javascript
const promised44 = () => Promise.resolve(44);
const interpreters = {
    prev: ECMAScriptInterpreters,
    values: {
        Identifier(e, c, cerr, env, config) {
            ECMAScriptInterpreters.values.Identifier(
                e,
                c,
                _ =>
                    promised44()
                        .then(c)
                        .catch(cerr),
                env,
                config
            );
        }
    }
};
metaesEval("var b=3; 2+a+b", console.log, console.error, {}, { interpreters }); // 49
```

As you can see, we're starting to see power of metacircullarity. We'll purposely stop here with building more abstractions.

### Synchronous vs asynchronous code

When overriding default behaviour of MetaeES (or using MetaES mixed with native code in general) you have to remember that not all code can be stopped or changed that easily. Those situations include native functions, like `Array.prototype.forEach`, `Array.prototype.map/filter/reduce` etc.

For example:

```javascript
const interpreters = {
    prev: ECMAScriptInterpreters,
    values: {
        Literal(e, c, cerr, env, config) {
            setTimeout(c, e.value);
        }
    }
};
metaesEval("[1,2,3].map(x=>x*x)", console.log, console.error, {}, { interpreters }); // [ NaN, NaN, NaN ]
```

Why not `[ 1, 4, 9 ]`? `Array.prototype.map` doesn't know anything about MetaES. Even `x=>x*x` being a metacircular function is not a problem:

```javascript
metaesEval(
    "x=>x*x",
    mapper =>
        // back in native code, but mapper is a metafunction
        console.log([1, 2, 3].map(mapper)), // [1,4,9]
    console.error
);
```

Problem is `Array.prototype.map`wants result synchronously - immediately without leaving current callstack. This is the same issue as if there was provided asynchronous function.`map` won't unpack `Promise` or anything else.

### Connect all the dots

Let's sum up what we've learned so far and create example service - "MetaQL", a GraphQL brother.

We simply want to send string query to the server through HTTP request and get JSON response.

First, a node.js part with `express.js` and `body-parser`:

```javascript
import { metaesEval } from "metaes/lib/metaes";

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post("/", (req, res) => {
    const { source, env } = req.body;
    console.log(req.body);
    try {
        metaesEval(
            source,
            result => res.json(result),
            error => res.status(500).json(Object.assign({}, error, { value: error.value.toString() })),
            env
        );
    } catch (e) {
        res.status(500).json({ value: e.message });
    }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

Running `$ curl --header "Content-Type: application/json" -X POST -d '{"source":"2+2"}' localhost:3000` will give back `4`, but

```sh
$ curl --header "Content-Type: application/json" -X POST  -d '{"source":"a"}' localhost:3000
```

will output:

```json
{
    "type": "ReferenceError",
    "value": "ReferenceError: \"a\" is not defined.",
    "location": {
        "type": "Identifier",
        "name": "a",
        "range": [0, 1],
        "loc": { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 1 }, "source": "true" }
    }
}
```

Adding `env` field fixes the problem:

```sh
$ curl --header "Content-Type: application/json" -X POST  -d '{"source":"a", "env":{"a":4}}' localhost:3000
```

gives `4`.

Now onto implementing something useful: current user and his friends:

```js
import { metaesEval } from "metaes/lib/metaes";

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

app.use(bodyParser.json());

const users = Array.from({ length: 10 }, (_, i) => ({ name: "User" + i }));

function getCurrentUser() {
    return users[Math.floor(Math.random() * users.length)];
}

function getFriendsOf(user) {
    return users.filter(candidate => candidate !== user);
}

const global = { values: { getCurrentUser, getFriendsOf } };

app.post("/", (req, res) => {
    const { source, env } = req.body;
    try {
        metaesEval(
            source,
            result => res.json(result),
            error => res.status(500).json(Object.assign({}, error, { value: error.value.toString() })),
            { values: env || {}, prev: global }
        );
    } catch (e) {
        res.status(500).json({ value: e.message });
    }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

Usage:

```sh
curl --header "Content-Type: application/json" -X POST  -d '{"source":"getFriendsOf(getCurrentUser())"}' localhost:3000
```

outputs: `[{"name":"User0"},{"name":"User1"},{"name":"User2"},{"name":"User3"},{"name":"User4"},{"name":"User5"},{"name":"User6"},{"name":"User8"},{"name":"User9"}]`.

Done. You can obviously compose results in any way you want, using complex queries like:

```sh
curl --header "Content-Type: application/json" -X POST  -d '{"source":"let user = getCurrentUser(); let friends = getFriendsOf(user); ({ user, friends }); "}' localhost:3000
```

to get:

```json
{
    "user": { "name": "User8" },
    "friends": [
        { "name": "User0" },
        { "name": "User1" },
        { "name": "User2" },
        { "name": "User3" },
        { "name": "User4" },
        { "name": "User5" },
        { "name": "User6" },
        { "name": "User7" },
        { "name": "User9" }
    ]
}
```

Note that script in MetaES evaluates to last expression; we had to wrap it in `()` to make it parsable by parser.

Further ideas to support as an exercise:

-   allow asynchronous access - maybe `getCurrentUser()` will talk to database?
-   restrict `interpreters` - maybe allow using only `CallExpression`, `Identifier` and couple of other nodes to improve sequrity and make performance more predictable?
-   limit time of execution, limit number of interceptor calls?

### Contexts and scripts

Contexts and scripts are mere a ways to organize and optimize `metaesEval` calls. In project like Vanillin, there are possibly hundreds of scripts at the same time, maybe running cooperatively at the same time.

#### Context

Context is a place where scripts can be executed. It's basically abstraction layer over `metaesEval` that remembers some default values (like default environment).

If you've ever developed browser extension, you remember there are page scripts and content scripts. Page scripts are normal script tags, but page scripts run "somewhere else" next to page scripts and can't easily see window object.

Simillary, context concept is required, because it semantically defines a place _where_ code will be executed (maybe in a different process, maybe on server, maybe in ServiceWorker, WebWorker?) and what global variables will be available for each script.

Example:

```javascript
const context = new MetaesContext(
    // default success callback
    console.log,
    // default error callback
    console.error,
    // global scope
    { Math }
);
context.evaluate("Math.random()");

// or even
const context2 = consoleLoggingMetaesContext({ Math });
// context2.evaluate(...);
```

As can you see, once defined callbacks and environment doesn't have to be repeated over and over again.

What is desirable, they can be overriden per call:

```javascript
context.evaluate("2+x", null, null, { x: 2 });
```

`null`s mean keeping default values. Order of arguments is the same as in `metaesEval`.

Here are actuall TypeScript definitions used for contexts:

```typescript
export type Evaluate = (
    input: Script | Source,
    c?: Continuation | null,
    cerr?: ErrorContinuation | null,
    environment?: Environment | object,
    config?: Partial<EvaluationConfig>
) => void;

export interface Context {
    evaluate: Evaluate;
}
```

This means, the only method required by `Context` is `evaluate`. It's very powerful, evaluation may happen anywhere including server, other process etc. as long objects transferring from memory to memory is provided. MetaES has some features supporting that, but it's still in tests. Read more in part about remote contexts.

#### Script

Script is a container for code that can be executed in a context. Script can be produced from string (as in native JavaScript) which is parsed by JavaScript parser, from native JavaScript function and from JSON object. Script can be produced from any source actually (up to the imagination of user), but eventually all kinds of inputs should be transformed to AST. Advantage of scripts is they don't have to be reparsed every time they're evaluated. They also have an unique ID (per host interpreter), which is useful for debugging.

It's simple, not much more to explain:

```javascript
const script = createScript(`console.log('hello world')`);
metaesEval(script, console.log, console.error, { console });
```

If you want to enable caching, use:

```javascript
const cache = createCache();
const script = createScript(`console.log('hello world')`, cache);

// won't be parsed again, AST object will be taken from cache
const script2 = createScript(`console.log('hello world')`, cache);
```

### `metaesEval` vs `eval`

`metaesEval` is like `eval`, but improved im some ways and limited in other. Let's compare.

First let's create `metaesEval` wrapper to ease experiments.

```javascript
function eval2(source, env) {
    let result, error;
    metaesEval(source, r => (result = r), e => (error = e), env);
    if (error) {
        throw error;
    }
    return result;
}
```

Now we can do for example:

```javascript
eval("2+2") === eval2("2+2"); // true;
```

Errors work too:

```javascript
let error1, error2;
try {
    eval("throw 1");
} catch (e) {
    error1 = e;
}
try {
    eval2("throw 1");
} catch (e) {
    error2 = e.value;
}
error1 === error2;
```

We had to unpack error thrown by `eval2` - in MetaES they're called exceptions and exceptions wrap original JavaScript error.

Consider other example:

```javascript
var a = 2;
eval("a+2"); // 4
```

standard `eval` captures surrounding scope, parses string end executes script. Easy and obvious, but:

```javascript
var a = 2;
eval2("a+2"); // ReferenceError: a is not defined
```

doesn't work. We already know why: no automatic closures or scope capturing in MetaES. We can mitigate it if we know how to use `call/cc` in MetaES. It's an advanced concept, thus for now only take a look how it could look like in improved version:

```javascript
eval3(function() {
    var a = 2;
    eval2("a+2");
});
```

We'd have just to create `eval3`, where `eval2` is predefined in its environment and is able to capture surrunding environment.
This will become easy after understanding MetaES deeper.

A last couple of examples just for fun:

```javascript
eval2("eval(1+2)"); // ReferenceError: eval is not defined.
eval2("eval(1+2)", { eval }); // 3
eval('eval2("eval(1+2)", {eval})'); // 3
```

### Observable context

Observable context follows loosely style of Proxy object. `ObservableContext` ihnerits from `MetaesContext`. Example:

```javascript
const value = { toObserve: {} };
const context = new ObservableContext(value);
context.addHandler({
    target: value.toObserve,
    traps: {
        set(object, prop, value) {
            console.log(object, prop, value);
        },
        didSet(object, prop, value) {
            console.log(object, prop, value);
        }
    }
});
const source = `self.toObserve.foo="bar"`;
context.evaluate(source);

// outputs:
// {} 'foo' 'bar'
// { foo: 'bar' } 'foo' 'bar'
```

All currently avialable traps are defined in Traps interface:

```typescript
type Traps = {
    set?: (target: object, key: string, args: any) => void;
    didSet?: (target: object, key: string, args: any) => void;
    apply?: (target: object, method: Function, args: any[], expressionValue: any) => void;
    didApply?: (target: object, method: Function, args: any[], expressionValue: any) => void;
};
```

`ObservableContext` constructor requires 2 arguments:

-   `target` - an object with will be come global environment and also will be available under `self` variable,
-   `mainTraps` - optional `Traps` object that will be attached to `target` object

`addHandler` expects `EvaluationHandler` which is:

```typescript
type ObserverHandler = {
    target: any;
    traps: Traps;
};
```

### Flame graph

`FlameGraph` represents history of evaluation for given script. Consider:

```javascript
const value = {
    a: 1,
    b: 2,
    c() {
        return 3;
    }
};
const context = new ObservableContext(value);

context.addListener(function(_evaluation, flameGraph) {
    if (flameGraph.executionStack.length === 1 && _evaluation.e.type === "Program") {
        console.log(flameGraph.executionStack);
    }
});
context.evaluate(`a+b+c()`);
```

`console.log` will output deeply nested object of whole AST interpretation. `ObservableContext` and `FlameGraph` are entirely based on interceptor. Go to the chapter about interceptor to understand it.

### Remote contexts (Work in Progress)

Remote contexts implement `Context` interface over JSON messages communication. To make it work its required to serialize/deserialize objects, gradually sending them from context to context. JSON can be send using any protocol, currently supported are HTTP and WebSockets.

For example:

```javascript
const serverContext = new MetaesContext(console.log, console.error, { user: { firstName: "user1" } });
const server = await runWSServer("3000", serverContext); // runs both WS and HTTP server

// read with HTTP

// Style 1
fetch("localhost:3000", { method: "post", body: "user.firstName" }).then(d => d.text()); // user1

// Style 2
const serverContext = createHTTPConnector("localhost:3000");
serverContext.evaluate("user.firstName", console.log); // user1

// read with WebSockets
const serverContextOverWS = createWSConnector(WebSocket)("ws://localhost:3000");
serverContextOverWS.evaluate("user.firstName", console.log); // user1
```

## Deeper understanding of MetaES

### CPS style

Let's start with CPS - continuation passing style.
Let's say we've got a function to add two numbers:

<metaes>

```js
function add(a, b) {
    return a + b;
}
```

</metaes>

To _use_ it just write:

<metaes>

```js
function add(a, b) {
    return a + b;
}
console.log(add(1, 2)); // 3
```

</metaes>

But imagine we can't use `return` keyword, because it doesn't exist in a language. How could we give caller the result back? Using callbacks, of course.

<metaes>

```js
function add(a, b, onSuccess) {
    onSuccess(a + b);
}
add(1, 2, result => {
    // [2] here we can continue our program
    console.log(result); // 3
});
// [1] don't know how to continue from this point using result
```

</metaes>

Here comes the problem: how to continue after result is given to the caller at position `[1]`? We're waiting for the result inside `result => console.log(result)` callback (`[2]`), not outside `add` call. Here we enter callback based control flow, very well known from node.js which very easily turns into **callback hell**. As we already know, that can be fixed using generators or async/await.

But in case of Metaes, callbacks are what we want. They are low level, fast, controllable, allow to suspend execution, allow to recreate any other control flow. We can also use more than one callback: one for success value, second for error value:

<metaes>

```js
function add(a, b, onSuccess, onError) {
    if (typeof a === "number" && typeof b === "number") {
        onSuccess(a + b);
    } else {
        onError(new Error("one of the operands is not a number"));
    }
}
// usage
add(1, 2, result => console.log("result is:", result), console.error);
```

</metaes>

Price to pay is worst readability of MetaES source code. Most of MetaES sources in fact could be written in async/await style and then compiled to older ECMAScript version if needed, but this approach would cause compiled code size explosion, slower performance (callbacks are faster than Promises and always will be because of Promises spec, async/await relies on Promises [TODO: link]) and would disallow to use calling with current continuation. The last thing called call/cc in LISP languages is something what we really, really want. It allows to recreate generators, yielding, coroutines and actually any other control flow.

Let's rename few things in `add` function:

<metaes>

```js
function add(a, b, c, cerr) {
    if (typeof a === "number" && typeof b === "number") {
        c(a + b);
    } else {
        cerr(new Error("one of the operands is not a number"));
    }
}
// usage
add(1, 2, result => console.log("result is:", result), console.error);
```

</metaes>

`c` is a `continuation`. `cerr` is `error continuation`. Now we now what continuation passing style stands for: it's just programming with callbacks for control flow, not return/throw.

Now we can go one step further with abstraction - let's abstract over evaluation.

Instead of saying `add(1, 2, result => console.log("result is:", result), console.error);` we want to say something like:

```js
evaluate(add, [1, 2], result => console.log("result is:", result), console.error);
```

Hopefully it starts to click and starts to resemble `metaesEval`.

`evaluate` is now:

```js
function evaluate(fn, args, c, cerr) {
    const fnWithArgs = fn.bind(null, args);
    fnWithArgs(c, cerr);
}
// use it
evaluate(add, [1, 2], result => console.log("result is:", result), console.error);
```

Next step, eliminate `add` reference and use lookup table:

```js
function add(a, b, c, cerr) {
    if (typeof a === "number" && typeof b === "number") {
        c(a + b);
    } else {
        cerr(new Error("one of the operands is not a number"));
    }
}
function evaluate(fnName, args, c, cerr) {
    const functions = { add };
    const fn = functions[fnName];
    if (fn) {
        fn.apply(null, args.concat([c, cerr]));
    } else {
        cerr(new ReferenceError(`${fnName} is not defined`));
    }
}
// use it
evaluate("add", [1, 2], result => console.log("result is:", result), console.error);

// it will throw
evaluate("add2", [1, 2], result => console.log("result is:", result), console.error);
```

Next piece is function subcalls. Simply use `evaluate` again with different args:

```js
function add(a, b, c, cerr) {
    if (typeof a === "number" && typeof b === "number") {
        c(a + b);
    } else {
        cerr(new Error("one of the operands is not a number"));
    }
}
function multiply(a, b, c, cerr) {
    if (typeof a === "number" && typeof b === "number") {
        c(a * b);
    } else {
        cerr(new Error("one of the operands is not a number"));
    }
}
function evaluate(fnName, args, c, cerr) {
    const functions = { add, multiply };
    const fn = functions[fnName];
    if (fn) {
        fn.apply(null, args.concat([c, cerr]));
    } else {
        cerr(new ReferenceError(`${fnName} is not defined`));
    }
}

evaluate(
    "add",
    [1, 2],
    result =>
        // got result from adding, now multiply it
        evaluate("multiply", [result, 3], result => console.log("result is:", result), console.error),
    console.error
);
```

Great, we can add and multiply in cumbersome and awkward way. Code is much slower, hard to read and modify.

Therefore... let's keep going!

Let's change numbers to `Literals`, like so:

```js
const literal1 = { type: "Literal", value: 1 };
const literal2 = { type: "Literal", value: 2 };
const literal3 = { type: "Literal", value: 3 };
```

and create AST-like structures for function calls (TODO: first create add and multiply functions, not immediabely BinaryExpression):

```js
const add = {
    type: "BinaryExpression",
    operator: "+",
    left: literal1,
    right: literal2
};

const multiply = {
    type: "BinaryExpression",
    operator: "*",
    left: add,
    right: literal3
};
```

Now refactor `evaluate` to accept AST-like nodes, not strings mixed with function names.

```js
const functions = {
    Literal(node, c) {
        c(node.value);
    },
    BinaryExpression(node, c) {
        evaluate(node.left, left =>
            evaluate(node.right, right => {
                switch (node.operator) {
                    case "+":
                        c(left + right);
                        break;
                    case "*":
                        c(left * right);
                        break;
                }
            })
        );
    }
};
function evaluate(node, c, cerr) {
    let fn = functions[node.type];
    fn ? fn(node, c, cerr) : cerr(new Error(`${node.type} function is not implemented yet.`));
}
evaluate(
    {
        type: "BinaryExpression",
        operator: "+",
        left: {
            type: "Literal",
            value: 1,
            raw: "1"
        },
        right: {
            type: "BinaryExpression",
            operator: "*",
            left: {
                type: "Literal",
                value: 2,
                raw: "2"
            },
            right: {
                type: "Literal",
                value: 3,
                raw: "3"
            }
        }
    },
    console.log
);
```

Done. And is very close to actual MetaES implementation. As an exercise you can implement `evaluate` in your favourite language.

At this point you can even use parser:

```javascript
// Let's pretend we went few steps forward
const metaesEval = evaluate;
metaesEval(parse("2+2"), console.log, console.error);
```

As an exercise add implementation of missing node types - `Program` and `Expression`.

For the record, many of ECMAScript AST nodes and internal operations had to be implemented in similar way.

Here's incomplete list:

```
"SetValue", "GetValue", "Identifier", "Literal", "Apply", "GetProperty", "SetProperty", "CallExpression", "MemberExpression", "ArrowFunctionExpression", "FunctionExpression", "AssignmentExpression", "ObjectExpression", "Property", "BinaryExpression", "ArrayExpression", "NewExpression", "SequenceExpression", "LogicalExpression", "UpdateExpression", "UnaryExpression", "ThisExpression", "ConditionalExpression", "TemplateLiteral", "BlockStatement", "Program", "VariableDeclarator", "VariableDeclaration", "AssignmentPattern", "IfStatement", "ExpressionStatement", "TryStatement", "ThrowStatement", "CatchClause", "ReturnStatement", "FunctionDeclaration", "ForInStatement", "ForStatement", "ForOfStatement", "WhileStatement", "EmptyStatement", "ClassDeclaration", "ClassBody", "MethodDefinition", "DebuggerStatement"
```

### Call with current continuation

Let's switch back to original MetaES implementation and get straight to the example:

```js
metaesEval(
    `2 + callcc(function(){ console.log("args", arguments); }, 'an argument')`,
    result => console.log("result", result),
    console.error,
    {
        callcc: callWithCurrentContinuation,
        console
    }
);
```

will output:

```
args: [ 'an argument',
  [Function],
  [Function],
  { values:
     { callcc: [Function: callWithCurrentContinuation],
       console: [Console] } },
  { script:
     { source: '2+callcc(function(){ console.log("args:", arguments); }, \'an argument\')',
       ast: [Script],
       scriptId: '0' },
    interpreters: { values: [Object] },
    interceptor: [Function: noop] } ]
```

As you can see, `callcc` calls given function with 5 arguments which are the same for every node intepreters. That means 2nd argument is a success continuation. Also notice, `"result"` wasn't logged. Script never finished, because `callcc` didn't resume evaluation. Let's resume:

```js
metaesEval(
    `2 + callcc(function(){ console.log("args", arguments); arguments[1](2) }, 'an argument')`,
    result => console.log("result", result),
    console.error,
    {
        callcc: callWithCurrentContinuation,
        console
    }
); // 4
```

Now we have `4` as a success result.

Now we're ready to say, that `callcc` - call with current continuation - does exactly what its name says. It calls function provided as first argument with 5 params, where two of them are `c` and `cerr`.

Let's refactor code to make it more readable and create something more useful - asynchronous fetch functions, similar to `async/await` with Promises:

```js
// [1]
const resources = {
    "/me": { firstName: "User1" },
    "/me/friends": [{ firstName: "User2" }, { firstName: "User3" }, { firstName: "User4" }]
};
// [2]
function fetcher(path, c, cerr) {
    const response = resources[path];
    response ? c(response) : cerr(new Error(`Resource '${path}' does not exist.`));
}
// [3]
let fetch;
metaesEval(`path=>callcc(fetcher, path)`, fn => (fetch = fn), console.error, {
    fetcher,
    callcc: callWithCurrentContinuation
});
metaesEval(
    // [4]
    `fetch('/me').firstName + ' has ' + fetch('/me/friends').length + ' friends'`,
    console.log,
    console.error,
    {
        console,
        fetch
    }
); // User1 has 3 friends
```

Explanation:

-   `[1]` - simulate network responses,
-   `[2]` - `fetcher` is a function that was called by callcc. `fetcher` is in charge or resuming evaluation using `c` or `cerr` with a value,
-   `[3]` - create metafunction with bound `callcc` in closure and assign it to variable `fetch`. `fetch` will be used as a wrapper for `callcc`. Direct `callcc` calls look unnatural and it's a leaking abstraction for us. `fetch` gets `path` as an argument and forwards it to `callcc`. `callcc` then stops evaluation and asks `fetcher` function to handle `c` and `cerr`. When `fetcher` calls any of those two continuations, the value of `callcc(...)` call becomes what was provided by `fetcher`,
-   `[4]` demonstrates previous statement. `fetch('/me')` becomes `{ firstName: "User1" }`.

#### Advantages and disadvantages of callcc

callcc allows reimplementation of all sorts of control flows: coroutines, asynchronity, iteration, generators etc.

Downside is questionable easiness of grasping what's going on under the hood, especially for beginners. Even after creating many examples it's easy to get confused. Consider this:

```javascript
const results = [];
let cc;
function receiver(_, _cc) {
    cc = _cc;
    cc([1, 2, 3]);
}
metaesEval(
    `for (let x of callcc(receiver)) {
        results.push(x);
    }`,
    null,
    console.error,
    { callcc: callWithCurrentContinuation, receiver, results }
);
console.log("results", results); // results [ 1, 2, 3 ]
cc([4, 5, 6]);
console.log("results", results); // results [ 1, 2, 3, 4, 5, 6 ]
```

`cc` was called completely outside of MetaES, after script already finished. Then script finished again.

It also produces giant closures inside MetaES which may lead to increased memory consumption, because callstack down to the point of callcc has to be remembered alongside with all the variables in scopes. For short living and small scripts it is a non issue though.

As exercises you can implement following concepts callable form MetaES space:

1.  `getCurrentCallstack()`
2.  `getThisFunctionClosure()`
3.  your own `Proxy` object
4.  your own `await` function
5.  your own generator function with `yield` support

</main>

<<include:includes/docs-imports.html>>
