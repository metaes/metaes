import { apply, evaluate, evaluateArray } from "../applyEval";
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
  evaluateArray(
    e.arguments,
    env,
    config,
    args => {
      let calleeNode = e.callee;

      switch (calleeNode.type) {
        case "MemberExpression":
          evaluate(
            calleeNode.object,
            env,
            config,
            object =>
              evaluate(
                calleeNode,
                env,
                config,
                property =>
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
          evaluate(
            calleeNode,
            env,
            config,
            callee => {
              try {
                c(apply(e, callee, args, config));
              } catch (error) {
                cerr(ensureException(error, calleeNode));
              }
            },
            cerr
          );
          break;
        case "ArrowFunctionExpression":
          evaluate(
            calleeNode,
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
  evaluate(
    e.object,
    env,
    config,
    object => {
      if (e.computed) {
        evaluate(
          e.property,
          env,
          config,
          property => {
            c(object[property]);
          },
          cerr
        );
      } else {
        switch (e.property.type) {
          case "Identifier":
            if (e.computed) {
              evaluate(
                e.property,
                env,
                config,
                value => {
                  c(object[value]);
                },
                cerr
              );
            } else {
              switch (e.property.type) {
                case "Identifier":
                  // just call interceptors, don't evaluate the Identifier which is not a Reference
                  // TODO: add tests/refactor
                  let _config = Object.assign({}, config, { useReferences: false });
                  callInterceptor(e.property, _config, env, { phase: "enter" });
                  callInterceptor(e.property, _config, env, { phase: "exit" });

                  c(object[e.property.name]);
                  break;
                default:
                  cerr(NotImplementedException(`Not implemented ${e.property["type"]} property type of ${e.type}`));
              }
            }
            break;
          case "Literal":
            evaluate(e.property, { values: object }, config, c, cerr);
            break;
          default:
            cerr(NotImplementedException("This kind of member expression is not supported yet."));
        }
      }
    },
    cerr
  );
}

export function ArrowFunctionExpression(e: ArrowFunctionExpression, env, config, c, cerr) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function FunctionExpression(e: FunctionExpression, env, config, c, cerr) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function AssignmentExpression(e: AssignmentExpression, env, config, c, cerr) {
  evaluate(
    e.right,
    env,
    config,
    right => {
      switch (e.left.type) {
        case "MemberExpression":
          const left = e.left;
          evaluate(
            e.left.object,
            env,
            config,
            object => {
              function doAssign(object, key, value) {
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

              if (left.computed) {
                evaluate(
                  left.property,
                  env,
                  config,
                  key => {
                    doAssign(object, key, right);
                  },
                  cerr
                );
              } else if (left.property.type === "Identifier") {
                doAssign(object, left.property.name, right);
              } else {
                cerr(NotImplementedException("This kind of assignment is not implemented yet.", left.property));
              }
            },
            cerr
          );
          break;
        case "Identifier":
          callInterceptor(e.left, config, right, env, "enter");
          setValueAndCallAfterInterceptor(e.left, env, config, e.left.name, right, false, c, cerr);
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
  evaluate(
    e.value,
    env,
    config,
    value => {
      c({ key, value });
    },
    cerr
  );
}

export function BinaryExpression(e: BinaryExpression, env, config, c, cerr) {
  evaluate(
    e.left,
    env,
    config,
    left => {
      evaluate(
        e.right,
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
  evaluateArray(e.elements, env, config, c, cerr);
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
    error => {
      if (error.value instanceof ReferenceError && e.operator === "typeof") {
        c("undefined");
      } else {
        cerr(error);
      }
    }
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
