import { evaluate, evaluateArray } from "../applyEval";
import { Environment, GetValue } from "../environment";
import { LocatedError, NotImplementedException, toException } from "../exceptions";
import { createMetaFunction, evaluateMetaFunction, getMetaFunction, isMetaFunction } from "../metafunction";
import * as NodeTypes from "../nodeTypes";
import { callWithCurrentContinuation } from "../special";
import { Continuation, ErrorContinuation, EvaluationConfig } from "../types";
import { IfStatement } from "./statements";

export function lastArrayItem(array?: any[]) {
  if (array) {
    return array[array.length - 1];
  }
  return null;
}

export function CallExpression(
  e: NodeTypes.CallExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) {
  evaluateArray(
    e.arguments,
    args => {
      switch (e.callee.type) {
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
                    evaluateMetaFunction(getMetaFunction(callee), c, cerr, undefined, args, config);
                  } else {
                    evaluate({ type: "Apply", e, fn: callee, args }, c, cerr, env, config);
                  }
                } catch (error) {
                  cerr(toException(error, e.callee));
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
          const e_callee = e.callee as NodeTypes.MemberExpression;
          evaluate(
            e_callee.object,
            object => {
              function run(property) {
                if (typeof property === "function") {
                  evaluate({ type: "Apply", e, fn: property, thisObj: object, args }, c, cerr, env, config);
                } else {
                  cerr({
                    value: new TypeError(typeof property + " is not a function")
                  });
                }
              }
              if (!e_callee.computed && e_callee.property.type === "Identifier") {
                run(object[e_callee.property.name]);
              } else {
                evaluate(e_callee.property, propertyValue => run(object[propertyValue]), cerr, env, config);
              }
            },
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
                const cnt = (thisObj?) =>
                  evaluate({ type: "Apply", e, fn: callee, thisObj, args }, c, cerr, env, config);
                GetValue({ name: "this" }, cnt, () => cnt(), env);
              } catch (error) {
                cerr(toException(error, e.callee));
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
            message: `This kind of callee node ('${e.callee.type}') is not supported yet.`,
            location: e.callee
          });
      }
    },
    cerr,
    env,
    config
  );
}

export function MemberExpression(e: NodeTypes.MemberExpression, c, cerr, env, config) {
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

function _createMetaFunction(
  e: NodeTypes.ArrowFunctionExpression | NodeTypes.FunctionExpression,
  c,
  cerr,
  env,
  config
) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ArrowFunctionExpression(e: NodeTypes.ArrowFunctionExpression, c, cerr, env, config) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function FunctionExpression(e: NodeTypes.FunctionExpression, c, cerr, env, config) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function AssignmentExpression(e: NodeTypes.AssignmentExpression, c, cerr, env, config: EvaluationConfig) {
  evaluate(
    e.right,
    right => {
      const e_left = e.left;
      switch (e_left.type) {
        case "Identifier":
          evaluate({ type: "SetValue", name: e_left.name, value: right, isDeclaration: false }, c, cerr, env, config);
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

export function ObjectExpression(e: NodeTypes.ObjectExpression, c, cerr, env, config) {
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

export function Property(e: NodeTypes.Property, c, cerr, env, config) {
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

export function BinaryExpression(e: NodeTypes.BinaryExpression, c, cerr, env, config) {
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

export function ArrayExpression(e: NodeTypes.ArrayExpression, c, cerr, env, config) {
  evaluateArray(e.elements, c, cerr, env, config);
}

export function NewExpression(e: NodeTypes.NewExpression, c, cerr, env, config) {
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
          GetValue(
            { name: calleeNode.name },
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
            cerr,
            env
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

export function SequenceExpression(e: NodeTypes.SequenceExpression, c, cerr, env, config) {
  evaluateArray(e.expressions, results => (results.length ? c(lastArrayItem(results)) : c()), cerr, env, config);
}

export function LogicalExpression(e: NodeTypes.LogicalExpression, c, cerr, env, config) {
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

export function UpdateExpression(e: NodeTypes.UpdateExpression, c, cerr, env: Environment) {
  switch (e.argument.type) {
    case "Identifier":
      const propName = e.argument.name;
      GetValue(
        { name: propName },
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
        cerr,
        env
      );
      break;
    default:
      cerr(NotImplementedException(`Support of argument of type ${e.argument.type} not implemented yet.`));
  }
}

export function UnaryExpression(e: NodeTypes.UnaryExpression, c, cerr, env: Environment, config) {
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

export function ThisExpression(_e: NodeTypes.ThisExpression, c, cerr, env: Environment) {
  GetValue({ name: "this" }, c, cerr, env);
}

export function ConditionalExpression(e: NodeTypes.ConditionalExpression, c, cerr, env, config) {
  IfStatement(e, c, cerr, env, config);
}

export function TemplateLiteral(e: NodeTypes.TemplateLiteral, c, cerr) {
  if (e.quasis.length === 1 && e.expressions.length === 0) {
    c(e.quasis[0].value.raw);
  } else {
    cerr(NotImplementedException(`Only single-quasis and expression-free template literals are supported for now.`));
  }
}

export default {
  CallExpression,
  MemberExpression,
  ArrowFunctionExpression,
  FunctionExpression,
  AssignmentExpression,
  ObjectExpression,
  Property,
  BinaryExpression,
  ArrayExpression,
  NewExpression,
  SequenceExpression,
  LogicalExpression,
  UpdateExpression,
  UnaryExpression,
  ThisExpression,
  ConditionalExpression,
  TemplateLiteral
};
