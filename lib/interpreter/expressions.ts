import { callcc } from "../callcc";
import { getEnvironmentForValue, GetValue } from "../environment";
import { evaluate, evaluateArray } from "../evaluate";
import { LocatedError, NotImplementedException, toException } from "../exceptions";
import { createMetaFunction, isMetaFunction, evaluateMetaFunction, getMetaFunction } from "../metafunction";
import * as NodeTypes from "../nodeTypes";
import { Continuation, Environment, ErrorContinuation, EvaluationConfig } from "../types";
import { IfStatement } from "./statements";

export function CallExpression(
  e: NodeTypes.CallExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig
) {
  evaluateArray(
    e.arguments,
    (args) => {
      args = args.reduce(
        (total, next) => (next instanceof SpreadElementValue ? total.concat(next.value) : total.concat([next])),
        []
      );
      switch (e.callee.type) {
        case "Super":
          GetValue(
            { name: "this" },
            (thisValue) =>
              evaluate(
                { type: "Apply", e, fn: Object.getPrototypeOf(thisValue).constructor, thisValue: thisValue, args },
                c,
                cerr,
                env,
                config
              ),
            cerr,
            env
          );
          break;
        case "Identifier":
        case "FunctionExpression":
        case "ConditionalExpression":
        case "CallExpression":
          evaluate(
            e.callee,
            (callee) => {
              if (typeof callee === "function") {
                try {
                  if (callee === callcc) {
                    try {
                      const [receiver, _arguments] = args;
                      receiver(_arguments, c, cerr, env, config);
                    } catch (e) {
                      cerr({ value: e, message: "Error in continuation receiver." });
                    }
                  } else {
                    evaluate({ type: "Apply", e, fn: callee, args }, c, cerr, env, config);
                  }
                } catch (error) {
                  cerr(toException(error, e.callee));
                }
              } else {
                cerr(toException(new TypeError(callee + " is not a function"), e.callee));
              }
            },
            cerr,
            env,
            config
          );
          break;
        case "MemberExpression":
          const e_callee = e.callee as NodeTypes.MemberExpression;
          const { loc, range } = e_callee;

          evaluate(
            e_callee.object,
            (object) => {
              function evalApply(property) {
                if (typeof property === "function") {
                  evaluate(
                    { type: "Apply", e, fn: property, thisValue: object, args, loc, range },
                    c,
                    cerr,
                    env,
                    config
                  );
                } else {
                  const source = config.script.source;
                  const callee = typeof source === "string" ? source.substring(...e_callee.range!) : "callee";
                  cerr(LocatedError(new TypeError(callee + " is not a function"), e_callee));
                }
              }
              if (!e_callee.computed && e_callee.property.type === "Identifier") {
                evaluate(
                  { type: "GetProperty", object, property: e_callee.property.name, loc, range },
                  evalApply,
                  cerr,
                  env,
                  config
                );
              } else {
                evaluate(
                  e_callee.property,
                  (propertyValue) =>
                    evaluate(
                      { type: "GetProperty", object, property: propertyValue, loc, range },
                      evalApply,
                      cerr,
                      env,
                      config
                    ),
                  cerr,
                  env,
                  config
                );
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
            (callee) => {
              try {
                const cnt = (thisValue?) =>
                  evaluate({ type: "Apply", e, fn: callee, thisValue, args }, c, cerr, env, config);
                evaluate({ type: "GetValue", name: "this" }, cnt, () => cnt(undefined), env, config);
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
            message: `'${e.callee.type}' callee node is not supported yet.`,
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
    (object) => {
      function getProperty() {
        evaluate(
          e.property,
          (property) => evaluate({ type: "GetProperty", object, property }, c, cerr, env, config),
          cerr,
          env,
          config
        );
      }
      if (e.computed) {
        getProperty();
      } else {
        switch (e.property.type) {
          case "Identifier":
            if (e.computed) {
              getProperty();
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
            // TODO: use GetProperty
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
    (right) => {
      const e_left = e.left;
      switch (e_left.type) {
        case "Identifier":
          evaluate({ type: "SetValue", name: e_left.name, value: right, isDeclaration: false }, c, cerr, env, config);
          break;
        case "MemberExpression":
          evaluate(
            e_left.object,
            (object) => {
              const property = e_left.property;
              if (e_left.computed) {
                evaluate(
                  e_left.property,
                  (property) =>
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
  evaluateArray(
    e.properties,
    (properties) => {
      const object = {};
      for (let { key, value } of properties) {
        object[key] = value;
      }
      c(object);
    },
    cerr,
    env,
    config
  );
}

export function Property(e: NodeTypes.Property, c, cerr, env, config) {
  if (e.computed) {
    evaluate(e.key, (key) => evaluate(e.value, (value) => c({ key, value }), cerr, env, config), cerr, env, config);
  } else {
    let key;
    switch (e.key.type) {
      case "Identifier":
        key = e.key.name;
        break;
      case "Literal":
        key = e.key.value;
        break;
      default:
        cerr(NotImplementedException(`'${e.key["type"]}' property key type is not supported yet.`));
        return;
    }
    evaluate(e.value, (value) => c({ key, value }), cerr, env, config);
  }
}

export function BinaryExpression(e: NodeTypes.BinaryExpression, c, cerr, env, config) {
  evaluate(
    e.left,
    (left) => {
      evaluate(
        e.right,
        (right) => {
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
              cerr(NotImplementedException(e.type + ` operator "${e.operator}" is not implemented yet.`, e));
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
    (args) => {
      let calleeNode = e.callee;

      switch (calleeNode.type) {
        case "MemberExpression":
        case "CallExpression":
        case "Identifier":
          evaluate(
            calleeNode,
            function (callee) {
              if (isMetaFunction(callee)) {
                const newThis = Object.create(callee.prototype);
                evaluateMetaFunction(
                  getMetaFunction(callee),
                  (value) => c(typeof value === "object" ? value : newThis),
                  cerr,
                  newThis,
                  args,
                  config
                );
              } else {
                if (typeof callee !== "function") {
                  cerr(LocatedError(new TypeError(typeof callee + " is not a function"), e));
                } else {
                  try {
                    c(new (Function.prototype.bind.apply(callee, [undefined].concat(args)))());
                  } catch (error) {
                    cerr(toException(error, calleeNode));
                  }
                }
              }
            },
            cerr,
            env,
            config
          );
          break;
        default:
          cerr(NotImplementedException(`${calleeNode["type"]} type of callee is not supported yet.`));
      }
    },
    cerr,
    env,
    config
  );
}

export function SequenceExpression(e: NodeTypes.SequenceExpression, c, cerr, env, config) {
  evaluateArray(e.expressions, (results) => (results.length ? c(results[results.length - 1]) : c()), cerr, env, config);
}

export function LogicalExpression(e: NodeTypes.LogicalExpression, c, cerr, env, config) {
  evaluate(
    e.left,
    (left) => {
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

export function UpdateExpression(e: NodeTypes.UpdateExpression, c, cerr, env: Environment, config) {
  function performUpdate(container, identifierName) {
    try {
      if (e.prefix) {
        switch (e.operator) {
          case "++":
            c(++container[identifierName]);
            break;
          case "--":
            c(--container[identifierName]);
            break;
          default:
            throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
        }
      } else {
        switch (e.operator) {
          case "++":
            c(container[identifierName]++);
            break;
          case "--":
            c(container[identifierName]--);
            break;
          default:
            throw NotImplementedException(`Support of operator of type '${e.operator}' not implemented yet.`);
        }
      }
    } catch (e) {
      cerr(e);
    }
  }
  let identifierName;
  switch (e.argument.type) {
    case "Identifier":
      identifierName = e.argument.name;
      const variableEnv = getEnvironmentForValue(env, identifierName)!;
      performUpdate(variableEnv.values, identifierName);
      break;
    case "MemberExpression":
      const arg = e.argument;
      if (arg.property.type === "Identifier") {
        const cont = (identifierName) =>
          evaluate(arg.object, (object) => performUpdate(object, identifierName), cerr, env, config);
        if (arg.computed) {
          evaluate(arg.property, cont, cerr, env, config);
        } else {
          cont(arg.property.name);
        }
      } else {
        cerr(NotImplementedException("Only identifiers are supported.", arg));
      }
      break;
    default:
      cerr(
        NotImplementedException(
          `Support of argument of type '${e.argument.type}' in UpdateExpression is not implemented yet.`
        )
      );
  }
}

export function UnaryExpression(e: NodeTypes.UnaryExpression, c, cerr, env: Environment, config) {
  evaluate(
    e.argument,
    (argument) => {
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
        case "delete":
          if (e.argument.type === "Identifier") {
            const name = e.argument.name;
            const variableEnv = getEnvironmentForValue(env, name);
            try {
              c(variableEnv!.values[name]);
            } catch (e) {
              cerr(e);
            }
          } else {
            cerr(NotImplementedException(`Delete on operator of type "${e.argument.type}" is not implemented yet.`));
          }
          break;
        default:
          cerr(NotImplementedException(`Support for "${e.operator}" operator is not implemented yet`));
      }
    },
    (error) =>
      e.operator === "typeof" && e.argument.type === "Identifier" && error.value instanceof ReferenceError
        ? c("undefined")
        : cerr(error),
    env,
    config
  );
}

export function ThisExpression(_e: NodeTypes.ThisExpression, c, cerr, env: Environment, config) {
  evaluate({ type: "GetValue", name: "this" }, c, cerr, env, config);
}

export function ConditionalExpression(e: NodeTypes.ConditionalExpression, c, cerr, env, config) {
  IfStatement(e, c, cerr, env, config);
}

export function TemplateLiteral(e: NodeTypes.TemplateLiteral, c, cerr, env, config) {
  if (e.quasis.length === 1 && e.expressions.length === 0) {
    c(e.quasis[0].value.raw);
  } else {
    evaluateArray(
      e.expressions,
      (expressions) =>
        c(expressions.map((expr, i) => e.quasis[i].value.raw + expr) + e.quasis[e.quasis.length - 1].value.raw),
      cerr,
      env,
      config
    );
  }
}

export function TaggedTemplateExpression(e: NodeTypes.TaggedTemplateExpression, c, cerr, env, config) {
  evaluate(
    e.tag,
    (tag) =>
      evaluate(
        e.quasi,
        (quasi) => evaluate({ type: "Apply", e, fn: tag, thisValue: undefined, args: [quasi] }, c, cerr, env, config),
        cerr,
        env,
        config
      ),
    cerr,
    env,
    config
  );
}

class SpreadElementValue {
  constructor(public value: any) {}
}

export function SpreadElement(e: NodeTypes.SpreadElement, c, cerr, env, config) {
  evaluate(e.argument, (value) => c(new SpreadElementValue(value)), cerr, env, config);
}

export function AwaitExpression(e: NodeTypes.AwaitExpression, c, cerr, env, config) {
  evaluate(e.argument, (arg) => (arg instanceof Promise ? arg.then(c) : c(arg)), cerr, env, config);
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
  TemplateLiteral,
  TaggedTemplateExpression,
  SpreadElement,
  AwaitExpression
};
