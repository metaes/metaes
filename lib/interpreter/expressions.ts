import { apply, evaluate, evaluateProp, evaluatePropWrap, evaluateArray } from "../applyEval";
import { Continuation, ErrorContinuation, EvaluationConfig } from "../types";
import { NotImplementedException, LocatedError, ensureException } from "../exceptions";
import { createMetaFunction } from "../metafunction";
import { callInterceptor, Environment, getReference, getValue, setValueAndCallAfterInterceptor } from "../environment";
import { IfStatement } from "./statements";
import {
  ArrayExpression,
  ArrowFunctionExpression,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  FunctionExpression,
  LogicalExpression,
  MemberExpression,
  NewExpression,
  ObjectExpression,
  Property,
  SequenceExpression,
  ThisExpression,
  UnaryExpression,
  UpdateExpression,
  TemplateLiteral
} from "../nodeTypes";

export function lastArrayItem(array?: any[]) {
  if (array) {
    return array[array.length - 1];
  }
  return null;
}

export function CallExpression(
  e: CallExpression,
  env: Environment,
  config: EvaluationConfig,
  c: Continuation,
  cerr: ErrorContinuation
) {
  evaluateProp(
    "arguments",
    e,
    env,
    config,
    args => {
      let calleeNode = e.callee;

      switch (calleeNode.type) {
        case "MemberExpression":
          evaluateProp(
            "callee",
            e,
            env,
            config,
            property =>
              evaluateProp(
                "object",
                calleeNode,
                env,
                config,
                object =>
                  typeof property === "function"
                    ? c(apply(e, property as Function, args, config, object))
                    : // TODO: use exceptions
                      cerr(new TypeError(typeof property + " is not a function")),
                cerr
              ),
            cerr
          );

          break;
        case "Identifier":
        case "FunctionExpression":
        case "CallExpression":
          evaluateProp(
            "callee",
            e,
            env,
            config,
            callee => {
              if (typeof callee === "function") {
                try {
                  c(apply(e, callee, args, config));
                } catch (error) {
                  cerr(ensureException(error, calleeNode));
                }
              } else {
                cerr(new TypeError(callee + " is not a function"));
              }
            },
            cerr
          );
          break;
        case "ArrowFunctionExpression":
          evaluateProp(
            "callee",
            e,
            env,
            config,
            callee => {
              try {
                const cnt = thisValue => c(apply(calleeNode, callee, args, config, thisValue));
                getValue(env, "this", cnt, () => cnt(undefined));
              } catch (error) {
                cerr(ensureException(error, calleeNode));
              }
            },
            cerr
          );
          break;
        default:
          cerr({
            type: "NotImplemented",
            message: `This kind of callee node ('${calleeNode.type}') is not supported yet.`,
            location: calleeNode
          });
      }
    },
    cerr
  );
}

export function MemberExpression(e: MemberExpression, env, config, c, cerr) {
  evaluateProp(
    "object",
    e,
    env,
    config,
    object => {
      if (e.computed) {
        evaluateProp("property", e, env, config, property => c(object[property]), cerr);
      } else {
        switch (e.property.type) {
          case "Identifier":
            if (e.computed) {
              evaluateProp("property", e, env, config, value => c(object[value]), cerr);
            } else {
              switch (e.property.type) {
                case "Identifier":
                  const propertyNode = e.property;
                  evaluatePropWrap(
                    "property",
                    (c, _cerr) => {
                      const value = object[propertyNode.name];
                      callInterceptor({ phase: "enter" }, config, e.property, env);
                      callInterceptor({ phase: "exit" }, config, e.property, env, value);
                      c(value);
                    },
                    e,
                    env,
                    config,
                    c,
                    cerr
                  );
                  break;
                default:
                  cerr(NotImplementedException(`Not implemented ${e.property["type"]} property type of ${e.type}`));
              }
            }
            break;
          case "Literal":
            evaluateProp("property", e, { values: object }, config, c, cerr);
            break;
          default:
            cerr(NotImplementedException("This kind of member expression is not supported yet."));
        }
      }
    },
    cerr
  );
}

function _createMetaFunction(e: ArrowFunctionExpression | FunctionExpression, env, config, c, cerr) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ArrowFunctionExpression(e: ArrowFunctionExpression, env, config, c, cerr) {
  _createMetaFunction(e, env, config, c, cerr);
}

export function FunctionExpression(e: FunctionExpression, env, config, c, cerr) {
  _createMetaFunction(e, env, config, c, cerr);
}

export function AssignmentExpression(e: AssignmentExpression, env, config, c, cerr) {
  evaluateProp(
    "right",
    e,
    env,
    config,
    right => {
      const e_left = e.left;

      switch (e_left.type) {
        case "MemberExpression":
          evaluatePropWrap(
            "left",
            (c, cerr) => {
              evaluateProp(
                "object",
                e.left,
                env,
                config,
                object => {
                  const property = e_left.property;
                  if (e_left.computed) {
                    evaluateProp("property", e_left, env, config, key => evalAssignment(object, key, right), cerr);
                  } else if (property.type === "Identifier") {
                    evaluatePropWrap(
                      "property",
                      (c, _cerr) => {
                        const value = property.name;
                        callInterceptor({ phase: "enter" }, config, property, env);
                        callInterceptor({ phase: "exit" }, config, property, env, value);
                        c(null);
                      },
                      e_left,
                      env,
                      config,
                      () => evalAssignment(object, property.name, right),
                      cerr
                    );
                  } else {
                    cerr(NotImplementedException("This kind of assignment is not implemented yet.", property));
                  }
                  function evalAssignment(object, key, value) {
                    switch (e.operator) {
                      case "=":
                        c((object[key] = value));
                        break;
                      case "+=":
                        c((object[key] += value));
                        break;
                      case "-=":
                        c((object[key] -= value));
                        break;
                      case "*=":
                        c((object[key] *= value));
                        break;
                      case "/=":
                        c((object[key] /= value));
                        break;
                      case "%=":
                        c((object[key] %= value));
                        break;
                      case "<<=":
                        c((object[key] <<= value));
                        break;
                      case ">>=":
                        c((object[key] >>= value));
                        break;
                      case ">>>=":
                        c((object[key] >>>= value));
                        break;
                      case "&=":
                        c((object[key] &= value));
                        break;
                      case "|=":
                        c((object[key] |= value));
                        break;
                      case "^=":
                        c((object[key] ^= value));
                        break;
                      default:
                        cerr(NotImplementedException(e.type + "has not implemented " + e.operator));
                    }
                  }
                },
                cerr
              );
            },
            e.left,
            env,
            config,
            c,
            cerr
          );

          break;
        case "Identifier":
          callInterceptor({ phase: "enter" }, config, e.left, right, env);
          setValueAndCallAfterInterceptor(e.left, env, config, e_left.name, right, false, c, cerr);
          break;
        default:
          cerr(NotImplementedException("This assignment is not supported yet."));
      }
    },
    cerr
  );
}

export function ObjectExpression(e: ObjectExpression, env, config, c, cerr) {
  let object = {};
  evaluateArray(
    e.properties,
    env,
    config,
    properties => {
      for (let property of properties) {
        object[property.key] = property.value;
      }
      c(object);
    },
    cerr
  );
}

export function Property(e: Property, env, config, c, cerr) {
  let key;
  switch (e.key.type) {
    case "Identifier":
      key = e.key.name;
      break;
    case "Literal":
      key = e.key.value;
      break;
    default:
      cerr(NotImplementedException("This type or property is not supported yet."));
      return;
  }
  evaluate(e.value, env, config, value => c({ key, value }), cerr);
}

export function BinaryExpression(e: BinaryExpression, env, config, c, cerr) {
  evaluateProp(
    "left",
    e,
    env,
    config,
    left => {
      evaluateProp(
        "right",
        e,
        env,
        config,
        right => {
          switch (e.operator) {
            case "+":
              c(left + right);
              break;
            case "-":
              c(left - right);
              break;
            case "===":
              c(left === right);
              break;
            case "==":
              c(left == right);
              break;
            case "!==":
              c(left !== right);
              break;
            case "!=":
              c(left != right);
              break;
            case "<":
              c(left < right);
              break;
            case "<=":
              c(left <= right);
              break;
            case ">":
              c(left > right);
              break;
            case ">=":
              c(left >= right);
              break;
            case "*":
              c(left * right);
              break;
            case "/":
              c(left / right);
              break;
            case "instanceof":
              c(left instanceof right);
              break;
            case "in":
              c(left in right);
              break;
            case "^":
              c(left ^ right);
              break;
            case "<<":
              c(left << right);
              break;
            case ">>":
              c(left >> right);
              break;
            case ">>>":
              c(left >>> right);
              break;
            case "%":
              c(left % right);
              break;
            case "&":
              c(left & right);
              break;
            case "|":
              c(left | right);
              break;
            default:
              cerr(NotImplementedException(e.type + " not implemented " + e.operator));
          }
        },
        cerr
      );
    },
    cerr
  );
}

export function ArrayExpression(e: ArrayExpression, env, config, c, cerr) {
  evaluateProp("elements", e, env, config, c, cerr);
}

export function NewExpression(e: NewExpression, env, config, c, cerr) {
  evaluateArray(
    e.arguments,
    env,
    config,
    args => {
      let calleeNode = e.callee;

      switch (calleeNode.type) {
        case "MemberExpression":
          evaluate(
            calleeNode,
            env,
            config,
            callee => {
              if (typeof callee !== "function") {
                cerr(LocatedError(new TypeError(typeof callee + " is not a function"), e));
              } else {
                try {
                  c(new (Function.prototype.bind.apply(callee, [undefined].concat(args)))());
                } catch (error) {
                  cerr(ensureException(error, e));
                }
              }
            },
            cerr
          );
          break;
        case "Identifier":
          getValue(
            env,
            calleeNode.name,
            callee => {
              if (typeof callee !== "function") {
                cerr(LocatedError(new TypeError(typeof callee + " is not a function"), e));
              } else {
                try {
                  c(new (Function.prototype.bind.apply(callee, [undefined].concat(args)))());
                } catch (error) {
                  cerr(ensureException(error, calleeNode));
                }
              }
            },
            cerr
          );
          break;
        default:
          cerr(NotImplementedException(`This type of callee is not supported yet.`));
      }
    },
    cerr
  );
}

export function SequenceExpression(e: SequenceExpression, env, config, c, cerr) {
  evaluateArray(e.expressions, env, config, results => (results.length ? c(lastArrayItem(results)) : c()), cerr);
}

export function LogicalExpression(e: LogicalExpression, env, config, c, cerr) {
  evaluate(
    e.left,
    env,
    config,
    left => {
      if (!left && e.operator === "&&") {
        c(left);
      } else if (left && e.operator === "||") {
        c(left);
      } else {
        evaluate(e.right, env, config, c, cerr);
      }
    },
    cerr
  );
}

export function UpdateExpression(e: UpdateExpression, env: Environment, _config, c, cerr) {
  switch (e.argument.type) {
    case "Identifier":
      getReference(
        env,
        e.argument.name,
        reference => {
          if (reference.environment && reference.name) {
            try {
              let container = reference.environment.values;
              let propName = reference.name;
              let value;
              if (e.prefix) {
                switch (e.operator) {
                  case "++":
                    value = ++container[propName];
                    break;
                  case "--":
                    value = --container[propName];
                    break;
                  default:
                    throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
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
                    throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
                }
              }
              c(value);
            } catch (e) {
              cerr(e);
            }
          }
        },
        cerr
      );

      break;
    default:
      cerr(NotImplementedException(`Support of argument of type ${e.argument.type} not implemented yet.`));
  }
}

export function UnaryExpression(e: UnaryExpression, env: Environment, config, c, cerr) {
  evaluate(
    e.argument,
    env,
    config,
    argument => {
      switch (e.operator) {
        case "typeof":
          c(typeof argument);
          break;
        case "-":
          c(-argument);
          break;
        case "!":
          c(!argument);
          break;
        case "+":
          c(+argument);
          break;
        case "~":
          c(~argument);
          break;
        case "void":
          c(void argument);
          break;
        default:
          cerr(NotImplementedException("not implemented " + e.operator));
      }
    },
    error => (error.value instanceof ReferenceError && e.operator === "typeof" ? c("undefined") : cerr(error))
  );
}

export function ThisExpression(_e: ThisExpression, env: Environment, _config, c, cerr) {
  getValue(env, "this", c, cerr);
}

export function ConditionalExpression(e: ConditionalExpression, env, config, c, cerr) {
  IfStatement(e, env, config, c, cerr);
}

export function TemplateLiteral(e: TemplateLiteral, _env, _config, c, cerr) {
  if (e.quasis.length === 1 && e.expressions.length === 0) {
    c(e.quasis[0].value.raw);
  } else {
    cerr(NotImplementedException(`Only single-quasis and expression-free template literals are supported for now.`));
  }
}
