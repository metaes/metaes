// The MIT License (MIT)
//
// Copyright (c) 2015 Bartosz Krupa
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function (fn) {
  if (typeof define !== "undefined") {
    // AMD (Browser)
    define([
      'bower_components/esprima/esprima'
    ], fn);
  } else if (typeof module !== "undefined") {
    // nodejs (CommonJS)
    module.exports = fn(require('esprima'));
  } else {
    // plain JS
    if (typeof esprima !== "undefined") {
      window.metaes = fn(esprima);
    } else {
      throw new Error("esprima is not loaded.");
    }
  }
}(function (esprima) {

  function clone(from) {
    var to = {};
    for (var i in from) {
      if (from.hasOwnProperty(i)) {
        to[i] = from[i];
      }
    }
    return to;
  }

  var tokens = {
    VariableDeclaration: function (e, env, c, cerr) {
      delayEvaluate(e.declarations, env, function () {
        c()
      }, cerr);
    },

    VariableDeclarator: function (e, env, c, cerr) {
      setValue(env, e.id.name, undefined, true);
      env.variables = env.variables || {};
      env.variables[e.id.name] = e.id;

      if (e.init) {
        delayEvaluate(e.init, env, function (val) {
          setValue(env, e.id.name, val, false);
          c(val, e.id.name);
        }, cerr);
      } else {
        c(undefined, e.id.name);
      }
    },

    EmptyStatement: function (e, env, c, cerr) {
      c();
    },

    FunctionExpression: function (e, env, c, cerr) {
      c(new MetaFunction(e, env));
    },

    FunctionDeclaration: function (e, env, c, cerr) {
      c(new MetaFunction(e, env));
    },

    Literal: function (e, env, c, cerr) {
      c(e.value);
    },

    Identifier: function (e, env, c, cerr) {
      try {
        function foundName(pair) {
          var value = pair[0],
            container = pair[1];
          c(value, container, e.name);
        }

        getValue(env, e.name, true, foundName, cerr);
      } catch (error) {
        cerr("Error", error, e);
      }
    },

    BinaryExpression: function (e, env, c, cerr) {
      delayEvaluate(e.left, env, function (left) {
        delayEvaluate(e.right, env, function (right) {
          try {
            var value;
            switch (e.operator) {
              case "+":
                value = left + right;
                break;
              case "-":
                value = left - right;
                break;
              case "===":
                value = left === right;
                break;
              case "==":
                value = left == right;
                break;
              case "!==":
                value = left !== right;
                break;
              case "!=":
                value = left != right;
                break;
              case "<":
                value = left < right;
                break;
              case "<=":
                value = left <= right;
                break;
              case ">":
                value = left > right;
                break;
              case ">=":
                value = left >= right;
                break;
              case "*":
                value = left * right;
                break;
              case "/":
                value = left / right;
                break;
              case "instanceof":
                value = left instanceof right;
                break;
              case "in":
                value = left in right;
                break;
              case "^":
                value = left ^ right;
                break;
              case "<<":
                value = left << right;
                break;
              case ">>":
                value = left >> right;
                break;
              case ">>>":
                value = left >>> right;
                break;
              case "%":
                value = left % right;
                break;
              case "&":
                value = left & right;
                break;
              case "|":
                value = left | right;
                break;
              default:
                throw new Error(e.type + " not implemented " + e.operator);
            }
            c(value, left, right);
          } catch (e) {
            cerr("Error", e);
          }
        }, cerr);
      }, cerr);
    },

    LogicalExpression: function (e, env, c, cerr) {
      delayEvaluate(e.left, env, function (left) {
        if (!left && e.operator === "&&") {
          c(left);
        } else if (left && e.operator === "||") {
          c(left);
        } else {
          delayEvaluate(e.right, env, c, cerr);
        }
      }, cerr);
    },

    UnaryExpression: function (e, env, c, cerr) {

      // this variable is "private symbol", used for `===` comparison
      var noSuchReference = {};

      function success(argument, obj, propName) {
        try {
          var envCopy = env,
            foundWithEnvironment;
          while (envCopy.prev) {
            if (envCopy.type === "WithStatement") {
              foundWithEnvironment = envCopy;
            }
            envCopy = envCopy.prev;
          }
          var
            global = envCopy,
            value;

          switch (e.operator) {
            case "delete":

              // make sure that for example
              // function(arg){
              //  arg = 2;
              //  delete arguments[0];
              //  return arg;
              // }
              // will work properly
              if (obj && obj === env.arguments && propName !== "length") {
                env.paramsNames[propName] = void 0;
              }

              // TODO: simplify
              if (e.argument.type === "Literal" ||
                e.argument.type === "CallExpression" ||
                e.argument.type === "ObjectExpression" ||
                propName === 'this' ||
                argument === noSuchReference) {

                // 3. return true for this, but don't delete
                // 4. reference not found in global, but return true
                value = true;
              } else if (foundWithEnvironment) {
                var obj2 = obj;
                if (propName in foundWithEnvironment.names) {
                  obj2 = foundWithEnvironment.names;
                }
                value = delete obj2[propName];
              } else if (
                obj === global.names ||
                e.argument.type !== "Identifier") {

                // always try to delete in global object or from object
                value = delete obj[propName];
              } else {
                // identifier not in global object, don't delete it, but return false
                value = false;
              }
              break;
            case "typeof":
              value = typeof argument;
              break;
            case "-":
              value = -argument;
              break;
            case "!":
              value = !argument;
              break;
            case "+":
              value = +argument;
              break;
            case "~":
              value = ~argument;
              break;
            case "void":
              value = void argument;
              break;
            default:
              throw new Error("not implemented " + e.operator);
          }
          c(value);
        } catch (e) {
          cerr("Error", e);
        }
      }

      function error(argument, obj, propName) {
        switch (e.operator) {
          case "typeof":
            // it means that reference was not declared,
            // so in case of `typeof`, "undefined" value should be returned
            c("undefined");
            break;
          case "delete":
            if (e.argument.type === "MemberExpression" && obj instanceof ReferenceError) {
              cerr.apply(null, arguments);
            } else {
              success(noSuchReference, obj, propName);
            }
            break;
          default:
            cerr.apply(null, arguments);
            break;
        }
      }

      delayEvaluate(e.argument, env, success, error);
    },

    LabeledStatement: function (e, env, c, cerr) {
      delayEvaluate(e.body, env, c, function (type, labelName, continuation) {
        if (e.label.name && e.label.name === labelName) {
          if (type === "ContinueStatement") {
            continuation();
          } else if (type === "BreakStatement") {
            c();
          }
        } else {
          cerr.apply(null, arguments);
        }
      });
    },

    ForStatement: function (e, env, c, cerr) {
      var bodyResults = [];
      if (e.init) {
        delayEvaluate(e.init, env, loop_, cerr);
      } else if (e.type === "WhileStatement") {
        loop_();
      } else {
        startBody();
      }

      function bodyC(result) {
        bodyResults.push(result);
        if (e.update) {
          delayEvaluate(e.update, env, loop_, cerr);
        } else {
          loop_(e, env);
        }
      }

      function updateAndContinue(c) {
        if (e.update) {
          delayEvaluate(e.update, env, function () {
            c.apply(null, bodyResults.reverse());
          }, cerr);
        } else {
          c.apply(null, bodyResults.reverse());
        }
      }

      function bodyCerr(errorType, value, extra) {
        switch (errorType) {
          case "BreakStatement":
            if (typeof value === "undefined") {
              c.apply(null, extra.length ? extra : [bodyResults.pop()]);
            } else {
              cerr(errorType, value, loop_);
            }
            break;
          case "ContinueStatement":
            if (typeof value === "undefined") {
              updateAndContinue(loop_);
            } else {
              // update first
              updateAndContinue(function () {
                cerr(errorType, value, loop_);
              });
            }
            break;
          default:
            cerr.apply(null, arguments);
            break;
        }
      }

      function evaluateBody() {
        delayEvaluate(e.body, env, bodyC, bodyCerr);
      }

      function loop_() {
        if (e.test) {
          delayEvaluate(e.test, env, function (bool) {
            if (bool) {
              evaluateBody();
            } else {
              c(bodyResults.reverse());
            }
          }, cerr);
        } else {
          evaluateBody();
        }
      }

      function startBody() {
        evaluateBody();
      }
    },

    BreakStatement: function (e, env, c, cerr) {
      cerr(e.type, (e.label ? e.label.name : undefined));
    },

    ContinueStatement: function (e, env, c, cerr) {
      cerr(e.type, (e.label ? e.label.name : undefined));
    },

    ForInStatement: function (e, env, c, cerr) {
      function rightHandSide() {
        delayEvaluate(e.right, env, function (right) {

          /**
           * Collect results into an array. Inconsistent with native implementation,
           * because all the getters would be called immediately at the very beginning
           */
          var
            leftHandSide = e.left.type === "VariableDeclaration" ? e.left.declarations[0].id : e.left,
            results = [];

          for (var i in right) {
            results.push(e.type === 'ForOfStatement' ? right[i] : i);
          }

          /**
           * Haven't found yet a better way to follow semantics of let-hand-side expression updates.
           * Remember that
           *
           * for(var x in z) {}
           * for(x in z) {}
           * for(x.y in z) {}
           *
           * are all valid programs.
           *
           * TODO: what about values attached to the original AST?
           */
          function assignment(value) {
            return {
              "type": "AssignmentExpression",
              "operator": "=",
              "left": leftHandSide,
              "right": {
                "type": "Literal",
                "value": value,
                "raw": "\"" + value + "\""
              }
            }
          }

          function bodyCerr(errorType, value, extra) {
            switch (errorType) {
              case "BreakStatement":
                if (typeof value === "undefined") {
                  c();
                } else {
                  cerr(errorType, value);
                }
                break;
              case "ContinueStatement":
                if (typeof value === "undefined") {
                  loop_();
                } else {
                  cerr(errorType, value);
                }
                break;
              default:
                cerr.apply(null, arguments);
                break;
            }
          }

          var loopResults;

          function loop_(result) {
            if (loopResults) {
              loopResults.push(result);
            } else {
              loopResults = [];
            }
            if (results.length) {
              delayEvaluate(assignment(results.shift()), env, function () {
                delayEvaluate(e.body, env, loop_, bodyCerr);
              }, cerr);
            } else {
              c(loopResults.pop());
            }
          }

          loop_();
        }, cerr)
      }

      delayEvaluate(e.left, env, rightHandSide, function (errorType, value) {
        if (errorType === "Error" && (value instanceof ReferenceError)) {
          setValue(env, e.left.name, undefined, false);
          rightHandSide();
        } else {
          cerr.apply(null, arguments);
        }
      })
    },

    WhileStatement: function (e, env, c, cerr) {
      tokens.ForStatement(e, env, c, cerr);
    },

    DoWhileStatement: function (e, env, c, cerr) {
      // TODO: create base function for all loops and call it with functions as configuration arguments
      tokens.ForStatement(e, env, c, cerr);
    },

    ExpressionStatement: function (e, env, c, cerr) {
      delayEvaluate(e.expression, env, c, cerr);
    },

    ObjectExpression: function (e, env, c, cerr) {
      delayEvaluate(e.properties, env, function (properties) {
        var objectProperties = Object.create(null);

        for (var i = 0; i < properties.length; i++) {
          var key = properties[i].key,
            kind = e.properties[i].kind;
          if (["get", "set"].indexOf(kind) >= 0) {
            objectProperties[key] = objectProperties[key] || {};

            // defaults
            objectProperties[key].enumerable = true;
            objectProperties[key].configurable = true;

            objectProperties[key][kind] = properties[i].value;
          } else {
            objectProperties[properties[i].key] = {
              value: properties[i].value,
              configurable: true,
              writable: true,
              enumerable: true
            };
          }
        }
        c(Object.create(Object.prototype, objectProperties));
      }, cerr);
    },

    Property: function (e, env, c, cerr) {
      function continueToValue(key) {
        key = e.key.name || key;
        delayEvaluate(e.value, env, function (value) {
          c({
            key: key,
            value: value
          });
        }, cerr);
      }

      delayEvaluate(e.key, env, continueToValue, continueToValue);
    },

    // TODO: clean up
    AssignmentExpression: function (e, env, c, cerr) {
      delayEvaluate(e.right, env, function (right) {
        // TODO: integrate with case below using env names containers (?) or something else
        function assignToMemberExpression(obj, propName, c) {
          var value;
          switch (e.operator) {
            case "=":
              value = obj[propName] = right;
              break;
            case "+=":
              value = obj[propName] += right;
              break;
            case "-=":
              value = obj[propName] -= right;
              break;
            case "*=":
              value = obj[propName] *= right;
              break;
            case "/=":
              value = obj[propName] /= right;
              break;
            case "%=":
              value = obj[propName] %= right;
              break;
            case "<<=":
              value = obj[propName] <<= right;
              break;
            case ">>=":
              value = obj[propName] >>= right;
              break;
            case ">>>=":
              value = obj[propName] >>>= right;
              break;
            case "&=":
              value = obj[propName] &= right;
              break;
            case "|=":
              value = obj[propName] |= right;
              break;
            case "^=":
              value = obj[propName] ^= right;
              break;
            default:
              throw new Error(e.type + " not implemented " + e.operator);
          }
          if ('arguments' in env && obj === env.arguments && typeof env.paramsNames[propName] !== "undefined") {
            setValue(env, env.paramsNames[propName], value, false);
          }
          c(value);
        }

        if (e.left.name) {
          function foundName(left) {
            var value;
            switch (e.operator) {
              case "=":
                value = left = right;
                break;
              case "+=":
                value = left += right;
                break;
              case "-=":
                value = left -= right;
                break;
              case "*=":
                value = left *= right;
                break;
              case "/=":
                value = left /= right;
                break;
              case "%=":
                value = left %= right;
                break;
              case "<<=":
                value = left <<= right;
                break;
              case ">>=":
                value = left >>= right;
                break;
              case ">>>=":
                value = left >>>= right;
                break;
              case "&=":
                value = left &= right;
                break;
              case "|=":
                value = left |= right;
                break;
              case "^=":
                value = left ^= right;
                break;
              default:
                throw new Error(e.type + " not implemented " + e.operator);
            }
            setValue(env, e.left.name, value, false);
            if ('arguments' in env) {
              var index = env.paramsNames.indexOf(e.left.name);
              if (index >= 0) {
                env.names.arguments[index] = value;
              }
            }
            c(value);
          }

          function notFoundNameButAssignToGlobal(errorType, error, flag, env) {
            // PutValue in global environment only if this is a simple assignment expression
            if (e.operator === "=") {
              // find global env
              var global = env;
              while (global.prev) {
                global = global.prev;
              }
              assignToMemberExpression(global.names, e.left.name, c);
            } else {
              cerr.apply(null, arguments);
            }
          }

          getValue(env, e.left.name, false, foundName, notFoundNameButAssignToGlobal);

        } else {
          delayEvaluate(e.left, env, function (prop, obj, propName) {
            assignToMemberExpression(obj, propName, c);
          }, cerr);
        }
      }, cerr);
    },

    UpdateExpression: function (e, env, c, cerr) {
      delayEvaluate(e.argument, env, function (argument, container, propName) {
        try {
          var value;
          if (e.prefix) {
            switch (e.operator) {
              case "++":
                value = ++container[propName];
                break;
              case "--":
                value = --container[propName];
                break;
              default:
                throw new Error("Implement me, " + e.operator);
            }
          } else {
            switch (e.operator) {
              case "++":
                value = container[propName]++;
                break;
              case "--":
                value = container[propName]--;
                break;
              default:
                throw new Error("Implement me, " + e.operator);
            }
          }
          c(value);
        } catch (e) {
          cerr("Error", e);
        }

      }, cerr);

    },

    ThisExpression: function (e, env, c, cerr) {
      function foundName(pair) {
        var
          value = pair[0],
          container = pair[1];
        c(value, container, 'this');
      }

      getValue(env, 'this', true, foundName, cerr);
    },

    CallExpression: function (e, env, c, cerr) {
      delayEvaluate(e.callee, env, function (callee, thisObj, calleeName) {
        delayEvaluate(e.arguments, env, function (args) {
          if (e.callee.type === "MemberExpression" && typeof callee === "undefined" || typeof callee !== "function") {
            cerr("Error", new TypeError(typeof callee + " is not a function"));
          } else {
            thisObj = e.callee.type === "MemberExpression" ? thisObj : null;
            if (env.type === "WithStatement" && env.names[calleeName] === callee) {
              thisObj = env.names;
            }
            delayApply(e, thisObj, callee, args, c, cerr, env);
          }
        }, cerr);
      }, cerr);
    },

    MemberExpression: function (e, env, c, cerr, pause) {
      delayEvaluate(e.object, env, function (object, name) {

        function extractor(obj, prop, propName) {

          // no support for arguments.callee.caller
          // TODO: optimize
          var value;
          if (typeof obj === "function" && propName === "caller") {
            value = void 0;
          } else {
            value = obj[prop];
          }
          applyInterceptor(e.property, value, env, pause);
          return value;
        }

        try {
          // check if `value` belongs to the object and is not taken from its prototype
          if (e.property.hasOwnProperty("value")) {
            c(extractor(object, e.property.value, e.property.name), object, e.property.value);
          } else if (e.computed) {
            delayEvaluate(e.property, env, function (member, property) {
              c(extractor(object, member, e.property.name), object, member);
            }, cerr);
          } else {
            c(extractor(object, e.property.name, e.property.name), object, e.property.name);
          }
        } catch (e) {
          cerr("Error", e);
        }
      }, cerr);
    },

    NewExpression: function (e, env, c, cerr) {
      delayEvaluate(e.arguments, env, function (args) {
        delayEvaluate(e.callee, env, function (ctor) {
          var obj;
          if (typeof ctor !== "function") {
            cerr("Error", new TypeError(typeof ctor + " is not a function"));
          } else if (ctor.metaFunction) {
            // delay constructor evaluation so don't use native `new`.
            if (typeof ctor.prototype === "object" || typeof ctor.prototype === "function") {
              obj = Object.create(ctor.prototype);
            } else {
              obj = Object.create(Object.prototype);
            }

            delayEvaluate(apply, e, obj, ctor, args, function (result) {
              // if constructor function returns object, then this object is the result of NewExpression
              c(typeof result === "object" || typeof result === "function" ? result : obj);
            }, cerr, env);
          } else {
            try {
              // create new object using given constructor function and unknown number of arguments
              obj = new (Function.prototype.bind.apply(ctor, [undefined].concat(args)));
              c(obj);
            } catch (e) {
              // possible TypeError
              cerr("Error", e);
            }
          }
        }, cerr);
      }, cerr);
    },

    ArrayExpression: function (e, env, c, cerr) {
      delayEvaluate(e.elements, env, function (result) {
        result.forEach(function (r, index) {
          if (typeof result[index] === "undefined") {
            // example: [,,] - in this case all indexes are not enumerable
            // TODO: what about reasigning value to index?
            Object.defineProperty(result, index, {
              enumerable: false
            });
          }
        });
        c(result);
      }, cerr);
    },

    WithStatement: function (e, env, c, cerr) {
      delayEvaluate(e.object, env, function (object) {

        // TODO: simplify
        if (typeof object == "undefined" || object === null ||
          typeof object === "number" || object === true || object === false) {

          cerr("Error", new TypeError(object + " has no properties"));
        } else {
          if (typeof object === "string") {
            object = new String(object);
          }
          var withCfg = clone(env.cfg),
            withEnv = {
              names: object,
              prev: env,
              cfg: withCfg,
              type: e.type
            };
          delayEvaluate(e.body, withEnv, c, cerr);
        }
      }, cerr);
    },

    BlockStatement: function (e, env, c, cerr) {

      function runHoisting(e) {
        var declarations = [];

        if (e.declarations) {
          declarations = e.declarations;
        } else {
          function isToken(o) {
            return o && o.type;
          }

          function search(e) {
            if (["FunctionDeclaration", "VariableDeclarator"].indexOf(e.type) >= 0) {
              declarations.push(e);
            } else if (["FunctionExpression", "FunctionDeclaration"].indexOf(e.type) === -1) {
              Object.keys(e).forEach(function (key) {
                var child = e[key];
                if (child &&
                  child.type && key !== "test") {
                  search(child);

                } else if (Array.isArray(child)) {
                  child.filter(isToken).forEach(search);
                }
              });
            }
          }
          e.forEach(search);
        }

        declarations.forEach(function (e) {
          var value;
          switch (e.type) {
            case "FunctionDeclaration":
            case "FunctionExpression":
              value = new MetaFunction(e, env);
              break;
          }
          setValue(env, e.id.name, value, true);
        });

        // TODO: warning: optimization that can corrupt live coding
        e.declarations = declarations;
      }

      // 1st pass, hoisting. Just collect declarations and bind them to values.
      runHoisting(e.body);

      function errorHandler(errorType, result, extraParam) {
        switch (errorType) {
          case "ReturnStatement":
          case "YieldExpression":
          case "ContinueStatement":
          case "BreakStatement":
          case "ThrowStatement":
          case "Error":
            cerr.apply(null, arguments);
            break;
          default:
            c.apply(null, arguments);
            break;
        }
      }

      // 2nd pass, execution.
      evaluate(e.body, env, function (results) {
        c(results.reverse()[0]);
      }, errorHandler);
    },

    SequenceExpression: function (e, env, c, cerr) {
      delayEvaluate(e.expressions, env, function (results) {
        c(results[results.length - 1]);
      }, cerr);
    },

    IfStatement: function (e, env, c, cerr) {
      delayEvaluate(e.test, env, function (test) {
        if (test) {
          delayEvaluate(e.consequent, env, c, cerr);
        } else if (e.alternate) {
          delayEvaluate(e.alternate, env, c, cerr);
        } else {
          c();
        }
      }, cerr);
    },

    ConditionalExpression: function (e, env, c, cerr) {
      tokens.IfStatement(e, env, c, cerr);
    },

    SwitchStatement: function (e, env, c, cerr) {
      function cleanup(c) {
        return function () {

          // TODO: clean up casePassed concept
          env.casePassed = false;
          c();
        }
      }

      delayEvaluate(e.discriminant, env, function (discriminant) {
        setValue(env, "discriminant", discriminant, true);

        // TODO: block discriminant access and remove after switch is finished
        function maybeBreak(value) {
          if (value === "BreakStatement") {
            c();
          } else {
            cerr.apply(null, arguments);
          }
        }

        env.casePassed = false;
        delayEvaluate(e.cases, env, cleanup(c), maybeBreak);
      }, cleanup(cerr));
    },

    SwitchCase: function (e, env, c, cerr) {
      getValue(env, "discriminant", false, function (discriminant) {
        if (e.test) {
          delayEvaluate(e.test, env, function (test) {
            if (env.casePassed || test === discriminant) {
              env.casePassed = true;
              delayEvaluate(e.consequent, env, c, cerr);
            } else {
              c();
            }
          }, cerr);
        } else if (env.casePassed) {
          // "default:" case
          delayEvaluate(e.consequent, env, c, cerr);
        }

      }, cerr);
    },

    TryStatement: function (e, env, c, cerr) {
      function finalizer(c) {
        if (e.finalizer) {
          delayEvaluate(e.finalizer, env, c, cerr);
        } else {
          c();
        }
      }

      function continueOrFinalize(result) {
        finalizer(c.bind(null, result));
      }

      function maybeCatch(errorType, throwArgument) {
        switch (errorType) {

          case "ReturnStatement":
          case "ContinueStatement":
          case "BreakStatement":
            var args = arguments;
            finalizer(function () {
              cerr.apply(null, args);
            });
            break;
          case "ThrowStatement":
          case "Error":
            // TODO: mark `throwArgument` as inacessible
            setValue(env, 'throwArgument', throwArgument, true);
            if (e.handlers.length) {
              delayEvaluate(e.handlers[0], env, function (result) {
                  // TODO: tidy up throwArgument here
                  delete env.names.throwArgument;
                  finalizer(c.bind(null, result));
                },
                function () {
                  var args = arguments;
                  finalizer(function () {
                    cerr.apply(null, args);
                  });
                });
            } else {
              finalizer(c);
            }
            break;
          default:
            cerr.apply(null, arguments);
            break;
        }
      }

      delayEvaluate(e.block, env, continueOrFinalize, maybeCatch);
    },

    ThrowStatement: function (e, env, c, cerr) {
      delayEvaluate(e.argument, env, function (argument) {
        cerr(e.type, argument);
      }, cerr);
    },

    CatchClause: function (e, env, c, cerr) {
      function foundName(value) {
        // assign catched variable value to the given reference name
        var catchEnv = {
          prev: env,
          names: {},
          type: e.type,
          cfg: env.cfg
        };
        catchEnv.names[e.param.name] = value;

        delayEvaluate(e.body, catchEnv, c, cerr);
      }

      getValue(env, 'throwArgument', false, foundName, cerr);
    },

    ReturnStatement: function (e, env, c, cerr, pause) {
      if (e.argument) {
        delayEvaluate(e.argument, env, function (result) {
          applyInterceptor(e, result, env, pause);
          cerr(e.type, result);
        }, cerr);
      } else {
        applyInterceptor(e, undefined, env, pause);
        cerr(e.type);
      }
    },

    DebuggerStatement: function (e, env, c, cerr) {
      debugger;
      c();
    },

    Program: function (e, env, c, cerr) {
      tokens.BlockStatement(e, env, c, cerr);
    },

    // ES6
    ArrowFunctionExpression: function (e, env, c, cerr) {
      // TODO: track `this` properly
      tokens.FunctionExpression(e, env, c, cerr);
    },

    ForOfStatement: function (e, env, c, cerr) {
      // TODO: create base function for all loops and call it with functions as configuration arguments
      tokens.ForInStatement(e, env, c, cerr);
    },

    ComprehensionExpression: function (e, env, c, cerr) {
      // TODO: what about values attached to the original AST?
      var construct = e.blocks.map(function (block) {
        return {
          left: block.left,
          right: block.right,
          body: e.body,
          type: "ForOfStatement"
        };
      });
      delayEvaluate(construct.reverse(), env, c, cerr);
    },

    YieldExpression: function (e, env, c, cerr) {
      delayEvaluate(e.argument, env, function (result) {
        cerr(e.type, result, c);
      }, cerr)
    }
  };

  function setValue(env, name, value, isDeclaration) {
    if (isDeclaration) {
      while (env.type === "CatchClause" || env.type === "WithStatement") {
        env = env.prev;
      }
      if (!(name in env.names)) {
        Object.defineProperty(env.names, name, {
          value: value,
          configurable: false,
          enumerable: true,
          writable: true
        });
      } else if (typeof value !== "undefined") {
        env.names[name] = value;
      }
      return value;
    } else {
      function loop_(env) {
        if (!env.prev) {
          return env.names;
        } else {
          if (name in env.names) {
            return env.names;
          } else {
            return loop_(env.prev);
          }
        }
      }

      return loop_(env)[name] = value;
    }
  }

  /**
   * Gets a value from an environment.
   *
   * @param env
   * @param name
   * @param shouldReturnContainer - If true, then return value and object that contains that value.
   * @param c
   * @param cerr
   */
  function getValue(env, name, shouldReturnContainer, c, cerr) {
    var envs = [];

    function getValueHelper(container, key) {
      var value = container[key];
      return shouldReturnContainer ? [value, container] : value;
    }

    function loop_(env) {

      if (!env) {
        if (cerr) {
          cerr("Error", new ReferenceError(name + " is not defined."), true, envs[0]);
        }
      } else {
        envs.push(env);
        if (name in env.names) {
          c(getValueHelper(env.names, name))
        } else {
          loop_(env.prev);
        }
      }
    }

    loop_(env);
  }

  /**
   * Constructor for Function in metacircular world.
   */
  function MetaFunction(e, env) {
    this.e = e;
    this.env = env;
    this.cfg = clone(env.cfg);

    var
      self = this,
      evaluationResult;

    function MetaInvokerInner() {

      // If metacirtular function is called from native function, it is important to return metacircular value
      // to the native function.
      self.run(this, arguments, c, cerr, self.env);

      // passing c to the `run` function should eventually set up `evaluationResult` variable with evaluated value
      return evaluationResult;
    }

    function cerr(errorType, e) {
      throw e;
    }

    // nowhere to continue
    function c(result) {
      evaluationResult = result;
    }

    var
      functionParamsNames = this.paramsNames = e.params.map(function (param) {
        return param.name;
      }),
      functionName = e.id ? e.id.name : "",
      functionSource =
        "(function " + functionName + "(" + functionParamsNames.join(",") + ") {" +
        "return MetaInvokerInner.apply(this,arguments)" +
        "})",
      MetaInvoker = eval(functionSource);

    MetaInvoker.toString = function () {
      return env.cfg.programText.substring(e.range[0], e.range[1]);
    };

    MetaInvoker.metaFunction = this;

    Object.defineProperties(MetaInvoker, {
      "toString": {
        enumerable: false
      },
      "metaFunction": {
        enumerable: false
      }
    });

    this.metaInvoker = MetaInvoker;

    return MetaInvoker;
  }

  MetaFunction.prototype.run = function (thisObj, args, c, cerr, prevEnv) {
    function buildArgsObject(input) {
      var mockedArgsObject = {};

      for (var i = 0; i < input.length; i++) {
        mockedArgsObject[i] = input[i];
      }

      Object.defineProperties(mockedArgsObject, {
        "length": {
          enumerable: false,
          value: input.length
        },
        "callee": {
          enumerable: false,
          value: self.metaInvoker
        }
      });
      return mockedArgsObject;
    }

    var _this;
    getValue(this.env, 'this', false, function (value) {
      _this = value;
    }, cerr);

    var
      cfg = prevEnv.cfg,
      self = this,
      argsObject = buildArgsObject(args),
      env = {
        fn: self,
        cfg: cfg,
        names: {
          this: thisObj || _this
        },
        closure: this.env,
        prev: prevEnv
      };

    // if function is named, pass its name to environment to allow recursive calls
    if (this.e.id) {
      setValue(env, this.e.id.name, this.metaInvoker, true);
    }

    Object.defineProperty(env.names, "arguments", {
      configurable: false,
      value: argsObject,
      writable: true
    });
    var functionResult;

    env.variables = env.variables || {};

    // set function scope variables variables based on formal function parameters
    this.e.params.forEach(function (param, i) {
      applyInterceptor(param, args[i], env);

      // TODO: clean up
      // create variable
      setValue(env, param.name, args[i], true);

      // assign (or reassign) variable
      setValue(env, param.name, args[i], false);

      env.variables[param.name] = param;
    });

    delayEvaluate(this.e.body, env,
      function (result) {
        c(undefined);
      },
      function (nodeType, result, extraParam) {
        switch (nodeType) {
          case "YieldExpression":
            throw new Error("Handle properly saving continuation here");
            break;
          case "ReturnStatement":
            c.call(null, result, extraParam);
            break;
          default:
            cerr.apply(null, arguments);
            break;
        }
      });

    execute();
    applyInterceptor(this.e, this.metaInvoker, env);
    return functionResult;
  };

  /**
   * In here the function is called from metacircular space. Therefore it's possible to give it some settings.
   */
  function apply(e, thisObj, fn, args, c, cerr, env) {
    if (fn === eval) {
      if (typeof args[0] === "string") {
        // here is the case where `eval` is executed in metacircular space, therefore it has to be
        // handled in special way
        function cc(e, result) {
          c(result);
        }

        metaEval(e, args, env, cc, cerr);
      } else {
        c(args[0]);
      }
    } else if (fn.metaFunction instanceof MetaFunction) {
      fn.metaFunction.run(thisObj, args, c, cerr, env);
    } else {
      try {
        c(fn.apply(thisObj, args));
      } catch (e) {
        cerr("Error", e);
      }
    }
  }

  function applyInterceptor(e, val, env, pause) {
    if ('interceptor' in env.cfg && e.type) {
      env.cfg.interceptor(e, val, env, pause);
    }
  }

  /**
   * Evaluates given AST node.
   *
   * @param e - currently evaluated AST node
   * @param env - current execution environment
   * @param c - continuation function
   * @param cerr - alternative continuation function, used by try/catch, return, break, continue
   */
  function evaluate(e, env, c, cerr) {
    if (Array.isArray(e)) {
      var results = [];

      function next(e) {
        if (e.length) {
          delayEvaluate(e[0], env,
            function (result) {
              results.push(result);
              next(e.slice(1));
            },
            function (errorType) {
              if (errorType === "BreakStatement") {
                cerr.apply(null, [].slice.call(arguments).concat([results]));
              } else {
                cerr.apply(null, arguments);
              }
            });
        } else {
          c(results);
        }
      }

      next(e);
    } else {
      // e can be null in [,,]
      if (e) {
        function success(result) {
          if (arguments.length > 1) {
            c.apply(null, arguments);
          } else {
            c(result);
          }
        }

        if (e.type in tokens) {
          if (e.range) {
            e.subProgram = env.cfg.programText.substring(e.range[0], e.range[1]);
          }
          tokens[e.type](e, env, success, cerr);
        } else {
          var error = new Error(e.type + " token is not yet implemented.");
          error.e = e;
          throw error;
        }
      } else {
        c();
      }
    }
  }

  // Global accumulator of expression to be executed
  // TODO: should be local for each subsequent VM?
  var tasksStack = [];

  /**
   * Creates a version of `fn` that is uncallable until it's allowed.
   *
   * @param fn - default function to be called
   * @param c - alternative function that can be called with a value instead of `fn`
   * @param args - arguments to `fn` if `fn` is called
   * @returns {{pauser: Function, delayed: Function}}
   */
  function createPausable(fn, c, args) {
    var
      locked = false,
      delayed = function () {
        if (!locked) {
          locked = true;
          if (arguments.length) {
            // alternative call with given continuation
            c.apply(null, arguments);
          } else {
            // normal call
            fn.apply(null, args);
          }
        }
      },
      resume = function () {
        locked = false;
        delayed.apply(null, arguments);

        // rerun the VM
        execute();
      },
      pauser = function () {
        locked = true;
        return function () {
          resume.apply(null, arguments);
        }
      };

    return {pauser: pauser, delayed: delayed};
  }

  function delayEvaluate(e, env, c, cerr) {
    var _c = c;
    c = function () {
      var continuation = createPausable(_c, _c, arguments);
      // give a change to the client code to pause and modify the execution after evaluation
      applyInterceptor(e, arguments, env, continuation.pauser);
      tasksStack.push(continuation.delayed);
    };
    var pausableEvaluate = createPausable(evaluate, c, arguments);

    // give a change to the client code to pause the execution before evaluation
    applyInterceptor(e, undefined, env, pausableEvaluate.pauser);
    pausableEvaluate.delayed();
    tasksStack.push(pausableEvaluate.delayed);
  }

  function delayApply(e, thisObj, callee, args, c, cerr, env) {
    var pausable = createPausable(apply, c, arguments);
    applyInterceptor(e, {this: thisObj, callee: callee, arguments: args}, env, pausable.pauser);
    tasksStack.push(pausable.delayed);
  }

  function execute() {
    while (tasksStack.length) {
      tasksStack.pop()();
    }
  }

  var parseConfig = {
    loc: true,
    range: true
  };

  function metaEval(node, programText, env, c, cerr) {

    // take only first argument that should be a text
    programText = programText[0];

    try {
      var e = esprima.parse(programText, parseConfig),
        env2,
        cfg = clone(env.cfg);

      cfg.programText = programText;

      // indirect eval call is run in global context
      if (node.callee.name !== "eval") {
        while (env.prev) {
          env = env.prev;
        }
      }
      env2 = clone(env);
      env2.cfg = cfg;

      function metaCerr() {
        // by pass 1st argument (ast)
        cerr.apply(null, [].slice.call(arguments, 1));
      }

      function metaC() {
        c.apply(null, arguments);
      }

      runVM(e, env2, metaC, metaCerr);

    } catch (error) {
      if (error.message.indexOf("Invalid left-hand side in assignment") >= 0) {
        cerr("Error", new ReferenceError(error.message));
      } else {
        cerr("Error", new SyntaxError(error.message));
      }
    }
  }

  var VMsCounter = 0;

  /**
   * This is the function calling the interpreter
   * @param text - JavaScript program
   * @param rootEnvironment - object containing key-values pairs that will be enviroment for `text`. Can be for example just `window`, or `{a: 1, b:2}`, or environment that has previous (outer) environment that should have following shape:

   ```js
   {
       name: [[key-valued object]],
       prev: [[literal or reference to another rootEnvironment]]
   }
   ```
   * @param c - function that will be called if evaluation finishes successfully
   * @param cerr - function that will be called if evaluation finishes with error (`SyntaxError`, `ReferenceError` of any kind of exception)
   * @param cfg - object with may contain following settings:

   ```
   {
     name: //name of the VM, can be filename or just any arbitrary name.
           Leaving it undefined will by default assign name like VMx where `x` is next natural number.
     interceptor: // function of signature `(e, value, env)` where `e` is AST node from exprima, value is JavaScript value
     and env is enviroment object compatible with `rootEnvironment` parameter
   }
   ```
   * @returns {*}
   */
  function mainEvaluate(text, rootEnvironment, cfg, c, cerr) {
    if (typeof text === "function") {
      text = "(" + text.toString() + ")";
    }
    var evaluationResult;

    cfg = cfg || {};
    cfg.programText = text;
    cfg.name = cfg.name || "VM" + VMsCounter++;

    rootEnvironment = rootEnvironment || {};

    try {
      var
        e = esprima.parse(text, parseConfig),
        env;
      if ('names' in rootEnvironment) {
        env = rootEnvironment;
        env.cfg = cfg;
      } else {
        env = {
          prev: null,
          names: rootEnvironment || {},
          cfg: cfg
        };
      }

      Object.defineProperty(env.names, 'this', {
        configurable: false,
        value: env.names
      });

      function wrapResult(continuation) {
        return function (ast, result, result2) {
          evaluationResult = result2 || result;
          if (continuation) {
            continuation.apply(null, arguments);
          } else if (result === "Error") {
            throw result2;
          }
        }
      }

      runVM(e, env, wrapResult(c), wrapResult(cerr));
      execute();
    } catch (err) {
      if (cerr) {
        cerr(null, err);
      } else {
        throw err;
      }
    }

    return evaluationResult;
  }

  function runVM(e, env, c, cerr) {
    evaluate(e, env, c.bind(null, e), cerr.bind(null, e));
  }

  return {
    evaluate: mainEvaluate
  };
}));

