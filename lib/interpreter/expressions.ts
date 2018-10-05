import { evaluate, evaluateArray } from "../applyEval";
import { Continuation, ErrorContinuation, EvaluationConfig } from "../types";
import { NotImplementedException, LocatedError, toException } from "../exceptions";
import { createMetaFunction, isMetaFunction, evaluateMetaFunction, getMetaFunction } from "../metafunction";
import { getCurrentEnvironment, callWithCurrentContinuation } from "../special";
import { Environment, getValue, setValue } from "../environment";
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
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) {
  evaluateArray(
    e.arguments,
    args => {
      let e_callee = e.callee;

      switch (e_callee.type) {
        case "Identifier":
        case "FunctionExpression":
        case "CallExpression":
          evaluate(
            e.callee,
            callee => {
              if (typeof callee === "function") {
                try {
                  if (callee === callWithCurrentContinuation) {
                    // Pass continuation to continuation receiver.
                    try {
                      args[0](args[1], c, cerr, env, config);
                    } catch (e) {
                      cerr({ value: e, message: "Error in continuation receiver." });
                    }
                  } else if (isMetaFunction(callee)) {
                    evaluateMetaFunction(getMetaFunction(callee), c, cerr, undefined, args);
                  } else {
                    evaluate({ type: "Apply", e, fn: callee, args }, c, cerr, env, config);
                  }
                } catch (error) {
                  cerr(toException(error, e_callee));
                }
              } else {
                cerr(new TypeError(callee + " is not a function"));
              }
            },
            cerr,
            env,
            config
          );
          break;
        case "MemberExpression":
          evaluate(
            e.callee,
            property =>
              evaluate(
                e_callee["object"],
                object => {
                  if (typeof property === "function") {
                    evaluate({ type: "Apply", e, fn: property, thisObj: object, args }, c, cerr, env, config);
                  } else {
                    cerr({
                      value: new TypeError(typeof property + " is not a function")
                    });
                  }
                },
                cerr,
                env,
                config
              ),
            cerr,
            env,
            config
          );
          break;
        case "ArrowFunctionExpression":
          evaluate(
            e.callee,
            callee => {
              try {
                const cnt = thisObj => evaluate({ type: "Apply", e, fn: callee, thisObj, args }, c, cerr, env, config);
                getValue(env, "this", cnt, () => cnt(undefined));
              } catch (error) {
                cerr(toException(error, e_callee));
              }
            },
            cerr,
            env,
            config
          );
          break;
        default:
          cerr({
            type: "NotImplemented",
            message: `This kind of callee node ('${e_callee.type}') is not supported yet.`,
            location: e_callee
          });
      }
    },
    cerr,
    env,
    config
  );
}

export function MemberExpression(e: MemberExpression, c, cerr, env, config) {
  evaluate(
    e.object,
    object => {
      if (e.computed) {
        evaluate(
          e.property,
          property => evaluate({ type: "GetProperty", object, property }, c, cerr, env, config),
          cerr,
          env,
          config
        );
      } else {
        switch (e.property.type) {
          case "Identifier":
            if (e.computed) {
              evaluate(
                e.property,
                property => evaluate({ type: "GetProperty", object, property }, c, cerr, env, config),
                cerr,
                env,
                config
              );
            } else {
              switch (e.property.type) {
                case "Identifier":
                  try {
                    evaluate({ type: "GetProperty", object, property: e.property.name }, c, cerr, env, config);
                  } catch (e) {
                    cerr(toException(e, e.property));
                  }
                  break;
                default:
                  cerr(NotImplementedException(`Not implemented ${e.property["type"]} property type of ${e.type}`));
              }
            }
            break;
          case "Literal":
            evaluate(e.property, c, cerr, { values: object }, config);
            break;
          default:
            cerr(NotImplementedException("This kind of member expression is not supported yet."));
        }
      }
    },
    cerr,
    env,
    config
  );
}

function _createMetaFunction(e: ArrowFunctionExpression | FunctionExpression, c, cerr, env, config) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ArrowFunctionExpression(e: ArrowFunctionExpression, c, cerr, env, config) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function FunctionExpression(e: FunctionExpression, c, cerr, env, config) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function AssignmentExpression(e: AssignmentExpression, c, cerr, env, config: EvaluationConfig) {
  evaluate(
    e.right,
    right => {
      const e_left = e.left;
      switch (e_left.type) {
        case "Identifier":
          setValue(env, e_left.name, right, false, c, cerr);
          break;
        case "MemberExpression":
          evaluate(
            e_left.object,
            object => {
              const property = e_left.property;
              if (e_left.computed) {
                evaluate(
                  e_left.property,
                  property =>
                    evaluate(
                      { type: "SetProperty", object, property, value: right, operator: e.operator },
                      c,
                      cerr,
                      env,
                      config
                    ),
                  cerr,
                  env,
                  config
                );
              } else if (property.type === "Identifier") {
                evaluate(
                  { type: "SetProperty", object, property: property.name, value: right, operator: e.operator },
                  c,
                  cerr,
                  env,
                  config
                );
              } else {
                cerr(NotImplementedException("This kind of assignment is not implemented yet.", property));
              }
            },
            cerr,
            env,
            config
          );
          break;
        default:
          cerr(NotImplementedException("This assignment is not supported yet."));
      }
    },
    cerr,
    env,
    config
  );
}

export function ObjectExpression(e: ObjectExpression, c, cerr, env, config) {
  let object = {};
  evaluateArray(
    e.properties,
    properties => {
      for (let property of properties) {
        object[property.key] = property.value;
      }
      c(object);
    },
    cerr,
    env,
    config
  );
}

export function Property(e: Property, c, cerr, env, config) {
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
  evaluate(e.value, value => c({ key, value }), cerr, env, config);
}

export function BinaryExpression(e: BinaryExpression, c, cerr, env, config) {
  evaluate(
    e.left,
    left => {
      evaluate(
        e.right,
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
        cerr,
        env,
        config
      );
    },
    cerr,
    env,
    config
  );
}

export function ArrayExpression(e: ArrayExpression, c, cerr, env, config) {
  evaluateArray(e.elements, c, cerr, env, config);
}

export function NewExpression(e: NewExpression, c, cerr, env, config) {
  evaluateArray(
    e.arguments,
    args => {
      let calleeNode = e.callee;

      switch (calleeNode.type) {
        case "MemberExpression":
          evaluate(
            calleeNode,
            callee => {
              if (typeof callee !== "function") {
                cerr(LocatedError(new TypeError(typeof callee + " is not a function"), e));
              } else {
                try {
                  c(new (Function.prototype.bind.apply(callee, [undefined].concat(args)))());
                } catch (error) {
                  cerr(toException(error, e));
                }
              }
            },
            cerr,
            env,
            config
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
                  cerr(toException(error, calleeNode));
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
    cerr,
    env,
    config
  );
}

export function SequenceExpression(e: SequenceExpression, c, cerr, env, config) {
  evaluateArray(e.expressions, results => (results.length ? c(lastArrayItem(results)) : c()), cerr, env, config);
}

export function LogicalExpression(e: LogicalExpression, c, cerr, env, config) {
  evaluate(
    e.left,
    left => {
      if (!left && e.operator === "&&") {
        c(left);
      } else if (left && e.operator === "||") {
        c(left);
      } else {
        evaluate(e.right, c, cerr, env, config);
      }
    },
    cerr,
    env,
    config
  );
}

export function UpdateExpression(e: UpdateExpression, c, cerr, env: Environment) {
  switch (e.argument.type) {
    case "Identifier":
      const propName = e.argument.name;
      getValue(
        env,
        propName,
        _ => {
          // discard found value
          // if value is found, there must be an env for that value, don't check for negative case
          let foundEnv: Environment = env;
          while (!(propName in foundEnv.values)) {
            foundEnv = foundEnv.prev!;
          }
          try {
            if (e.prefix) {
              switch (e.operator) {
                case "++":
                  c(++foundEnv.values[propName]);
                  break;
                case "--":
                  c(--foundEnv.values[propName]);
                  break;
                default:
                  throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
              }
            } else {
              switch (e.operator) {
                case "++":
                  c(foundEnv.values[propName]++);
                  break;
                case "--":
                  c(foundEnv.values[propName]--);
                  break;
                default:
                  throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
              }
            }
          } catch (e) {
            cerr(e);
          }
        },
        cerr
      );
      break;
    default:
      cerr(NotImplementedException(`Support of argument of type ${e.argument.type} not implemented yet.`));
  }
}

export function UnaryExpression(e: UnaryExpression, c, cerr, env: Environment, config) {
  evaluate(
    e.argument,
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
    error => (error.value instanceof ReferenceError && e.operator === "typeof" ? c("undefined") : cerr(error)),
    env,
    config
  );
}

export function ThisExpression(_e: ThisExpression, c, cerr, env: Environment) {
  getValue(env, "this", c, cerr);
}

export function ConditionalExpression(e: ConditionalExpression, c, cerr, env, config) {
  IfStatement(e, c, cerr, env, config);
}

export function TemplateLiteral(e: TemplateLiteral, c, cerr) {
  if (e.quasis.length === 1 && e.expressions.length === 0) {
    c(e.quasis[0].value.raw);
  } else {
    cerr(NotImplementedException(`Only single-quasis and expression-free template literals are supported for now.`));
  }
}
