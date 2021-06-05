import { callcc } from "../callcc";
import { getEnvironmentForValue } from "../environment";
import { apply, at, evaluate, evaluateArray, get, getProperty, set, setProperty, visitArray } from "../evaluate";
import { LocatedException, NotImplementedException, toException } from "../exceptions";
import { createMetaFunctionWrapper, evaluateMetaFunction, getMetaFunction, isMetaFunction } from "../metafunction";
import * as NodeTypes from "../nodeTypes";
import { Interpreter } from "../types";
import { bindArgs, getInterpreter } from "./../metaes";
import { createClass } from "./statements";

const concatSpreads = (all, next) => (next instanceof SpreadElementValue ? all.concat(next.value) : all.concat([next]));

export const CallExpression: Interpreter<NodeTypes.CallExpression> = (e, c, cerr, env, config) =>
  evaluateArray(
    e.arguments,
    (args) => {
      args = args.reduce(concatSpreads, []);
      switch (e.callee.type) {
        case "Super":
          evaluate(
            get("this"),
            (thisValue) =>
              evaluate(
                at(e, apply(Object.getPrototypeOf(thisValue).constructor, thisValue, args, e)),
                c,
                cerr,
                env,
                config
              ),
            cerr,
            env,
            config
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
                      cerr(toException(e));
                    }
                  } else {
                    evaluate(at(e, apply(callee, undefined, args, e)), c, cerr, env, config);
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
          const e_callee = e.callee;

          evaluate(
            e.callee.object,
            (object) => {
              function evalApply(property) {
                if (typeof property === "function") {
                  evaluate(at(e, apply(property, object, args, e)), c, cerr, env, config);
                } else {
                  const source = config.script.source;
                  const callee = typeof source === "string" ? source.substring(...e.callee.range!) : "callee";
                  cerr(LocatedException(new TypeError(callee + " is not a function"), e.callee));
                }
              }
              if (!e_callee.computed && e_callee.property.type === "Identifier") {
                evaluate(at(e_callee, getProperty(object, e_callee.property.name)), evalApply, cerr, env, config);
              } else {
                evaluate(
                  e_callee.property,
                  (propertyValue) =>
                    evaluate(at(e_callee, getProperty(object, propertyValue)), evalApply, cerr, env, config),
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
                const cnt = (thisValue?) => evaluate(at(e, apply(callee, thisValue, args, e)), c, cerr, env, config);
                evaluate(at(e.callee, get("this")), cnt, () => cnt(undefined), env, config);
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
          cerr(NotImplementedException(`'${e.callee["type"]}' callee node is not supported yet.`, e.callee));
      }
    },
    cerr,
    env,
    config
  );

export const MemberExpression: Interpreter<NodeTypes.MemberExpression> = (e, c, cerr, env, config) =>
  evaluate(
    e.object,
    (object) => {
      function getProp() {
        evaluate(
          e.property,
          (property) => evaluate(at(e.property, getProperty(object, property)), c, cerr, env, config),
          cerr,
          env,
          config
        );
      }
      if (e.computed) {
        getProp();
      } else {
        switch (e.property.type) {
          case "Identifier":
            if (e.computed) {
              getProp();
            } else {
              switch (e.property.type) {
                case "Identifier":
                  evaluate(at(e.property, getProperty(object, e.property.name)), c, cerr, env, config);
                  break;
                default:
                  cerr(NotImplementedException(`Not implemented ${e.property["type"]} property type of ${e.type}`));
              }
            }
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

const _createMetaFunction: Interpreter<NodeTypes.ArrowFunctionExpression | NodeTypes.FunctionExpression> = (
  e,
  c,
  cerr,
  env,
  config
) => {
  try {
    c(createMetaFunctionWrapper({ e, closure: env, config }));
  } catch (error) {
    cerr(LocatedException(error, e));
  }
};

export const ArrowFunctionExpression: Interpreter<NodeTypes.ArrowFunctionExpression> = (e, c, cerr, env, config) =>
  _createMetaFunction(e, c, cerr, env, config);

export const FunctionExpression: Interpreter<NodeTypes.FunctionExpression> = (e, c, cerr, env, config) =>
  _createMetaFunction(e, c, cerr, env, config);

export const AssignmentExpression: Interpreter<NodeTypes.AssignmentExpression> = (e, c, cerr, env, config) =>
  evaluate(
    e.right,
    (right) => {
      const e_left = e.left;
      switch (e_left.type) {
        case "Identifier":
          evaluate(at(e_left, set(e_left.name, right)), c, cerr, env, config);
          break;
        case "MemberExpression":
          evaluate(
            e_left.object,
            (object) => {
              const property = e_left.property;
              if (e_left.computed) {
                evaluate(
                  e_left.property,
                  (property) => evaluate(at(e, setProperty(object, property, right, e.operator)), c, cerr, env, config),
                  cerr,
                  env,
                  config
                );
              } else if (property.type === "Identifier") {
                evaluate(at(e, setProperty(object, property.name, right, e.operator)), c, cerr, env, config);
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

export const ObjectExpression: Interpreter<NodeTypes.ObjectExpression> = (e, c, cerr, env, config) => {
  let result = {};
  visitArray(
    e.properties,
    (itemNode, c, cerr) =>
      evaluate(
        itemNode,
        function (item) {
          if (item instanceof SpreadElementValue) {
            c((result = Object.assign(result, item.value)));
          } else {
            const { key, value } = item;
            c((result[key] = value));
          }
        },
        cerr,
        env,
        config
      ),
    () => c(result),
    cerr
  );
};

export const Property: Interpreter<NodeTypes.Property> = (e, c, cerr, env, config) => {
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
};

export const BinaryExpression: Interpreter<NodeTypes.BinaryExpression> = (e, c, cerr, env, config) =>
  evaluate(
    e.left,
    (left) =>
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
      ),
    cerr,
    env,
    config
  );

export const ArrayExpression: Interpreter<NodeTypes.ArrayExpression> = (e, c, cerr, env, config) =>
  evaluateArray(e.elements, (values) => c(values.reduce(concatSpreads, [])), cerr, env, config);

export const NewExpression: Interpreter<NodeTypes.NewExpression> = (e, c, cerr, env, config) =>
  evaluateArray(
    e.arguments,
    (args) => {
      const calleeNode = e.callee;

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
                  { metaFunction: getMetaFunction(callee), thisObject: newThis, args },
                  (value) => c(typeof value === "object" ? value : newThis),
                  cerr,
                  undefined,
                  config
                );
              } else {
                if (typeof callee !== "function") {
                  cerr(LocatedException(new TypeError(typeof callee + " is not a function"), e));
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

export const SequenceExpression: Interpreter<NodeTypes.SequenceExpression> = (e, c, cerr, env, config) =>
  evaluateArray(e.expressions, (results) => (results.length ? c(results[results.length - 1]) : c()), cerr, env, config);

export const LogicalExpression: Interpreter<NodeTypes.LogicalExpression> = (e, c, cerr, env, config) =>
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

export const UpdateExpression: Interpreter<NodeTypes.UpdateExpression> = (e, c, cerr, env, config) => {
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
};

export const UnaryExpression: Interpreter<NodeTypes.UnaryExpression> = (e, c, cerr, env, config) =>
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
          switch (e.argument.type) {
            case "Identifier":
              const name = e.argument.name;
              const variableEnv = getEnvironmentForValue(env, name);
              try {
                c(variableEnv!.values[name]);
              } catch (e) {
                cerr(e);
              }
              break;
            case "MemberExpression": {
              const argumentNode = e.argument;
              evaluate(
                e.argument.object,
                (object) => {
                  const evalProperty = () =>
                    evaluate(argumentNode.property, (property) => c(delete object[property]), cerr, env, config);

                  switch (argumentNode.property.type) {
                    case "Identifier":
                      if (argumentNode.computed) {
                        evalProperty();
                      } else {
                        c(delete object[argumentNode.property.name]);
                      }
                      break;
                    default:
                      evalProperty();
                      break;
                  }
                },
                cerr,
                env,
                config
              );
              break;
            }
            default:
              cerr(NotImplementedException(`Delete on operator of type "${e.argument.type}" is not implemented yet.`));
              break;
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

export const ThisExpression: Interpreter<NodeTypes.ThisExpression> = (e, c, cerr, env, config) =>
  evaluate(at(e, get("this")), c, cerr, env, config);

export const ConditionalExpression: Interpreter<NodeTypes.ConditionalExpression> = (e, c, cerr, env, config) =>
  getInterpreter("IfStatement", bindArgs(e, c, cerr, env, config), cerr, config);

export const TemplateLiteral: Interpreter<NodeTypes.TemplateLiteral> = (e, c, cerr, env, config) => {
  if (e.quasis.length === 1 && e.expressions.length === 0) {
    c(e.quasis[0].value.raw);
  } else {
    evaluateArray(
      e.expressions,
      (expressions) =>
        c(
          expressions.map((expr, i) => e.quasis[i].value.raw + expr).join("") + e.quasis[e.quasis.length - 1].value.raw
        ),
      cerr,
      env,
      config
    );
  }
};

export const TaggedTemplateExpression: Interpreter<NodeTypes.TaggedTemplateExpression> = (e, c, cerr, env, config) =>
  evaluate(
    e.tag,
    (tag) =>
      typeof tag === "function"
        ? evaluate(
            e.quasi,
            (quasi) => evaluate(at(e.quasi, apply(tag, undefined, [quasi], e)), c, cerr, env, config),
            cerr,
            env,
            config
          )
        : cerr(toException(new TypeError(`Template expression tag is not a function`), e.tag)),
    cerr,
    env,
    config
  );

class SpreadElementValue {
  constructor(public value: any) {}
}

export const SpreadElement: Interpreter<NodeTypes.SpreadElement> = (e, c, cerr, env, config) =>
  evaluate(e.argument, (value) => c(new SpreadElementValue(value)), cerr, env, config);

export const AwaitExpression: Interpreter<NodeTypes.AwaitExpression> = (e, c, cerr, env, config) =>
  evaluate(
    e.argument,
    (arg) => (typeof arg === "object" && arg instanceof Promise ? arg.then(c) : c(arg)),
    cerr,
    env,
    config
  );

export const ClassExpression: Interpreter<NodeTypes.ClassExpression> = (e, c, cerr, env, config) =>
  createClass(e, c, cerr, env, config);

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
  AwaitExpression,
  ClassExpression
};
