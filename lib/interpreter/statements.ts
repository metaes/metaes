import { at, declare, evaluate, evaluateArray, get, getTrampolineScheduler, set, visitArray } from "../evaluate";
import { LocatedException, NotImplementedException, toException } from "../exceptions";
import { createMetaFunctionWrapper } from "../metafunction";
import * as NodeTypes from "../nodeTypes";
import { Environment, Interpreter, MetaesException } from "../types";
import { createInternalEnv } from "./../environment";
import { getProperty } from "./../evaluate";
import { bindArgs, getInterpreter } from "./../metaes";

const hoistDeclarations: Interpreter<NodeTypes.Statement[]> = (e, c, cerr, env, config) =>
  visitArray(
    e.filter((e) => e.type === "FunctionDeclaration") as NodeTypes.FunctionDeclaration[],
    (e, c, cerr) =>
      evaluate(e, (value) => evaluate(declare(e.id.name, value), c, cerr, env, config), cerr, env, config),
    c,
    cerr
  );

export const BlockStatement: Interpreter<NodeTypes.BlockStatement | NodeTypes.Program> = (e, c, cerr, env, config) =>
  hoistDeclarations(
    e.body,
    () => evaluateArray(e.body, (blockValues) => c(blockValues[blockValues.length - 1]), cerr, env, config),
    cerr,
    env,
    config
  );

export const Program: Interpreter<NodeTypes.Program> = (e, c, cerr, env, config) =>
  getInterpreter("BlockStatement", bindArgs(e, c, cerr, env, config), cerr, config);

export const VariableDeclaration: Interpreter<NodeTypes.VariableDeclaration> = (e, c, cerr, env, config) =>
  visitArray(e.declarations, (declarator, c, cerr) => evaluate(declarator, c, cerr, env, config), c, cerr);

export const ObjectPatternTarget = "[[ObjectPatternTarget]]";

export const VariableDeclarator: Interpreter<NodeTypes.VariableDeclarator> = (e, c, cerr, env, config) => {
  function assign(rightValue) {
    switch (e.id.type) {
      case "Identifier":
        evaluate(declare(e.id.name, rightValue), c, cerr, env, config);
        break;
      case "ObjectPattern":
        evaluate(e.id, c, cerr, createInternalEnv({ [ObjectPatternTarget]: rightValue }, env), config);
        break;
      case "ArrayPattern":
        let index = 0;
        visitArray(
          e.id.elements,
          function (element, c, cerr) {
            switch (element.type) {
              case "Identifier":
                evaluate(declare(element.name, rightValue[index++]), c, cerr, env, config);
                break;
              case "RestElement":
                evaluate(declare(element.argument.name, rightValue.slice(index)), c, cerr, env, config);
                break;
              default:
                cerr(NotImplementedException(`'${element["type"]}' ArrayPattern element is not supported.`, element));
                break;
            }
          },
          c,
          cerr
        );
        break;
      default:
        cerr(NotImplementedException(`Init '${(<any>e.id).type}' is not supported yet.`, e));
    }
  }
  e.init ? evaluate(e.init, assign, cerr, env, config) : assign(undefined);
};

export const ObjectPattern: Interpreter<NodeTypes.ObjectPattern> = (e, c, cerr, env, config) =>
  evaluate(
    get(ObjectPatternTarget),
    (rightValue) =>
      visitArray(
        e.properties,
        (property, c, cerr) => {
          if (property.value.type === "AssignmentPattern") {
            evaluate(property, c, cerr, env, config);
          } else if (property.computed) {
            cerr(NotImplementedException(`Computed property in ObjectPattern is not supported yet.`, property));
          } else {
            if (property.key.type === "Identifier") {
              const keyName = property.key.name;
              if (!rightValue) {
                cerr(
                  toException(new TypeError(`Cannot destructure property \`${keyName}\` of 'undefined' or 'null'.`))
                );
              } else {
                function assignValue(value?) {
                  switch (property.value.type) {
                    case "Identifier":
                      evaluate(at(property, declare(property.value.name, value)), c, cerr, env, config);
                      break;
                    case "ObjectPattern":
                      if (value) {
                        evaluate(
                          property.value,
                          c,
                          cerr,
                          createInternalEnv({ [ObjectPatternTarget]: value }, env),
                          config
                        );
                      } else {
                        cerr(
                          toException(
                            new TypeError(`Cannot destructure property \`${keyName}\` of 'undefined' or 'null'.`)
                          )
                        );
                      }
                      break;
                    default:
                      cerr(
                        NotImplementedException(`'${property.value.type}' in ObjectPattern value is not supported yet.`)
                      );
                      break;
                  }
                }
                evaluate(
                  getProperty(rightValue, keyName),
                  assignValue,
                  (e) => (e.value instanceof ReferenceError ? assignValue() : cerr(e)),
                  env,
                  config
                );
              }
            } else {
              cerr(NotImplementedException(`'${property.key.type}' in ObjectPattern property is not supported yet.`));
            }
          }
        },
        c,
        cerr
      ),
    cerr,
    env,
    config
  );

export const AssignmentPattern: Interpreter<NodeTypes.AssignmentPattern> = (e, c, cerr, env, config) => {
  if (e.left.type === "Identifier") {
    function assignRight() {
      evaluate(e.right, (right) => evaluate(declare(e.left.name, right), c, cerr, env, config), cerr, env, config);
    }
    evaluate(
      get(ObjectPatternTarget),
      (destructuredValue) => {
        evaluate(
          at(e.left, getProperty(destructuredValue, e.left.name)),
          (value) => (value ? evaluate(at(e.left, declare(e.left.name, value)), c, cerr, env, config) : assignRight()),
          assignRight,
          env,
          config
        );
      },
      cerr,
      env,
      config
    );
  } else {
    cerr(NotImplementedException(`${e.left.type} is not supported as AssignmentPattern left-hand side value.`, e.left));
  }
};

export const IfStatement: Interpreter<NodeTypes.IfStatement | NodeTypes.ConditionalExpression> = (
  e,
  c,
  cerr,
  env,
  config
) =>
  evaluate(
    e.test,
    (test) => {
      if (test) {
        evaluate(e.consequent, c, cerr, env, config);
      } else if (e.alternate) {
        evaluate(e.alternate, c, cerr, env, config);
      } else {
        c();
      }
    },
    cerr,
    env,
    config
  );

export const ExpressionStatement: Interpreter<NodeTypes.ExpressionStatement> = (e, c, cerr, env, config) =>
  evaluate(e.expression, c, cerr, env, config);

export const ExceptionName = "[[CatchClauseException]]";

export const TryStatement: Interpreter<NodeTypes.TryStatement> = (e, c, cerr, env, config) =>
  evaluate(
    e.block,
    c,
    (exception) =>
      exception.type === "ReturnStatement"
        ? cerr(exception)
        : evaluate(
            e.handler,
            () => (e.finalizer ? evaluate(e.finalizer, c, cerr, env, config) : c()),
            cerr,
            {
              values: {
                [ExceptionName]: exception
              },
              prev: env
            },
            config
          ),
    env,
    config
  );

export const ThrowStatement: Interpreter<NodeTypes.ThrowStatement> = (e, _c, cerr, env, config) =>
  evaluate(e.argument, (value) => cerr(value), cerr, env, config);

export const CatchClause: Interpreter<NodeTypes.CatchClause> = (e, c, cerr, env, config) =>
  evaluate(
    get(ExceptionName),
    (error: MetaesException) =>
      evaluate(
        e.body,
        c,
        cerr,
        {
          values: {
            [e.param.name]: error.value
          },
          prev: env
        },
        config
      ),
    cerr,
    env,
    config
  );

export const ReturnStatement: Interpreter<NodeTypes.ReturnStatement> = (e, _c, cerr, env, config) =>
  e.argument
    ? evaluate(e.argument, (value) => cerr({ type: "ReturnStatement", value }), cerr, env, config)
    : cerr({ type: "ReturnStatement" });

export const BreakStatement: Interpreter<NodeTypes.BreakStatement> = (_e, _c, cerr) => cerr({ type: "BreakStatement" });

export const FunctionDeclaration: Interpreter<NodeTypes.FunctionDeclaration> = (e, c, cerr, env, config) => {
  try {
    c(createMetaFunctionWrapper({ e, closure: env, config }));
  } catch (error) {
    cerr(LocatedException(error, e));
  }
};

export const ForInStatement: Interpreter<NodeTypes.ForInStatement> = (e, c, cerr, env, config) =>
  evaluate(
    e.right,
    (right) => {
      const left = e.left;
      switch (left.type) {
        case "Identifier":
          visitArray(
            Object.keys(right),
            (name, c, cerr) =>
              evaluate(at(left, set(left.name, name)), () => evaluate(e.body, c, cerr, env, config), cerr, env, config),
            c,
            cerr
          );
          break;
        case "VariableDeclaration": {
          const declaration0 = left.declarations[0];
          function loopAssigningToVariable(name: string, bodyEnv: Environment) {
            visitArray(
              Object.keys(right),
              (value, c, cerr) =>
                evaluate(
                  at(declaration0, declare(name, value)),
                  () => evaluate(e.body, c, cerr, bodyEnv, config),
                  cerr,
                  env,
                  config
                ),
              c,
              cerr
            );
          }
          const bodyEnv = { prev: env, values: {} };
          switch (declaration0.id.type) {
            case "Identifier":
              loopAssigningToVariable(declaration0.id.name, bodyEnv);
              break;
            default:
              cerr(
                NotImplementedException(
                  `Left-hand side of type ${left.declarations[0].id.type} in ${e.type} not implemented yet.`,
                  e.left
                )
              );
              break;
          }
          break;
        }
        default:
          cerr(NotImplementedException("Only identifier in left-hand side is supported now."));
          break;
      }
    },
    cerr,
    env,
    config
  );

export const WhileStatement: Interpreter<NodeTypes.WhileStatement> = (e, c, cerr, env, config) => {
  const schedule = getTrampolineScheduler();
  (function loop() {
    evaluate(
      e.test,
      (test) =>
        test
          ? schedule(() =>
              evaluate(
                e.body,
                loop,
                (ex) => {
                  if (ex.type === "BreakStatement") {
                    c();
                  } else if (ex.type === "ContinueStatement") {
                    loop();
                  } else {
                    cerr(ex);
                  }
                },
                env,
                config
              )
            )
          : c(),
      cerr,
      env,
      config
    );
  })();
};

export const DoWhileStatement: Interpreter<NodeTypes.DoWhileStatement> = (e, c, cerr, env, config) => {
  const schedule = getTrampolineScheduler();
  function body() {
    evaluate(e.body, test, cerr, env, config);
  }
  function test() {
    evaluate(
      e.test,
      (value) =>
        value
          ? schedule(() => evaluate(e.body, test, (ex) => (ex.type === "BreakStatement" ? c() : cerr(ex)), env, config))
          : c(),
      cerr,
      env,
      config
    );
  }
  body();
};

export const ForStatement: Interpreter<NodeTypes.ForStatement> = (e, c, cerr, env, config) => {
  const schedule = getTrampolineScheduler();
  const update = () => (e.update ? evaluate(e.update, test, cerr, env, config) : test());
  const test = () => (e.test ? evaluate(e.test, (test) => (test ? body() : c()), cerr, env, config) : body());
  const body = () => schedule(() => evaluate(e.body, update, cerr, { values: {}, prev: env }, config));
  if (e.init) {
    evaluate(e.init, test, cerr, env, config);
  } else {
    test();
  }
};

export const ContinueStatement: Interpreter<NodeTypes.ContinueStatement> = (e, _c, cerr, env, config) => {
  const kontinue = (label?) => cerr({ type: "ContinueStatement", value: label });
  if (e.label) {
    evaluate(e.label, kontinue, cerr, env, config);
  } else {
    kontinue();
  }
};

export const ForOfStatement: Interpreter<NodeTypes.ForOfStatement> = (e, c, cerr, env, config) =>
  evaluate(
    e.right,
    (right) => {
      if (!Array.isArray(right)) {
        cerr(NotImplementedException("Only arrays as right-hand side of for-of loop are supported for now.", e.right));
      } else {
        function loopAssigningToVariable(name: string, bodyEnv: Environment) {
          visitArray(
            right,
            (value, c, cerr) =>
              evaluate(
                at(e.right, declare(name, value)),
                () => evaluate(e.body, c, cerr, bodyEnv, config),
                cerr,
                env,
                config
              ),
            c,
            cerr
          );
        }
        const bodyEnv = { prev: env, values: {} };

        switch (e.left.type) {
          case "Identifier":
            loopAssigningToVariable(e.left.name, bodyEnv);
            break;
          case "VariableDeclaration":
            const declaration0 = e.left.declarations[0];
            switch (declaration0.id.type) {
              case "Identifier":
                loopAssigningToVariable(declaration0.id.name, bodyEnv);
                break;
              case "ObjectPattern":
                visitArray(
                  right,
                  function (rightValue, c, cerr) {
                    const bodyEnv = createInternalEnv({ [ObjectPatternTarget]: rightValue }, env);
                    evaluate(declaration0.id, () => evaluate(e.body, c, cerr, bodyEnv, config), cerr, bodyEnv, config);
                  },
                  c,
                  cerr
                );
                break;
              default:
                cerr(
                  NotImplementedException(
                    `Left-hand side of type ${e.left.declarations[0].id.type} in ${e.type} not implemented yet.`,
                    e.left
                  )
                );
                break;
            }
            break;
          default:
            cerr(
              NotImplementedException(
                `Left-hand side of type ${e.left["type"]} in ${e.type} not implemented yet.`,
                e.left
              )
            );
        }
      }
    },
    cerr,
    env,
    config
  );

export const EmptyStatement: Interpreter<NodeTypes.EmptyStatement> = (_e, c) => c();

export const createClass: Interpreter<NodeTypes.ClassDeclaration | NodeTypes.ClassExpression> = (
  e,
  c,
  cerr,
  env,
  config
) => {
  function onSuperClass(superClass) {
    let klass = function () {};
    evaluate(
      e.body,
      (body) =>
        visitArray(
          body,
          ({ key, value }, c) => {
            try {
              if (key === "constructor") {
                if (superClass) {
                  value.prototype = Object.create(superClass.prototype);
                }
                c((klass = value));
              } else {
                c((klass.prototype[key] = value));
              }
            } catch (e) {
              cerr(toException(e, e.body));
            }
          },
          () => c(klass),
          cerr
        ),
      cerr,
      env,
      config
    );
  }
  if (e.superClass) {
    evaluate(e.superClass, onSuperClass, cerr, env, config);
  } else {
    onSuperClass(null);
  }
};

export const ClassDeclaration: Interpreter<NodeTypes.ClassDeclaration> = (e, c, cerr, env, config) =>
  createClass(
    e,
    (klass) =>
      e.id
        ? evaluate(declare(e.id.name, klass), c, cerr, env, config)
        : cerr(NotImplementedException("Not implemented case")),
    cerr,
    env,
    config
  );

export const ClassBody: Interpreter<NodeTypes.ClassBody> = (e, c, cerr, env, config) =>
  evaluateArray(e.body, c, cerr, env, config);

export const MethodDefinition: Interpreter<NodeTypes.MethodDefinition> = (e, c, cerr, env, config) =>
  evaluate(e.value, (value) => c({ key: e.key.name, value }), cerr, env, config);

export const DebuggerStatement: Interpreter<NodeTypes.DebuggerStatement> = (_e, c) => {
  debugger;
  c();
};

export const SwitchStatement: Interpreter<NodeTypes.SwitchStatement> = (e, c, cerr, env, config) => {
  let fallthrough = false;
  evaluate(
    e.discriminant,
    (discriminant) => {
      visitArray(
        e.cases,
        function (caseNode, c, cerr) {
          const evalConsequent = () => evaluateArray(caseNode.consequent, c, cerr, env, config);
          if (caseNode.test) {
            evaluate(
              caseNode.test,
              (test) => {
                if (fallthrough || discriminant === test) {
                  fallthrough = true;
                  evalConsequent();
                } else {
                  c(null);
                }
              },
              cerr,
              env,
              config
            );
          } else {
            evalConsequent();
          }
        },
        c,
        (e) => (e.type === "BreakStatement" ? c() : cerr(e))
      );
    },
    cerr,
    env,
    config
  );
};

export default {
  BlockStatement,
  Program,
  VariableDeclarator,
  VariableDeclaration,
  ObjectPattern,
  AssignmentPattern,
  IfStatement,
  ExpressionStatement,
  TryStatement,
  ThrowStatement,
  CatchClause,
  ReturnStatement,
  BreakStatement,
  FunctionDeclaration,
  ForInStatement,
  ForStatement,
  ForOfStatement,
  WhileStatement,
  ContinueStatement,
  EmptyStatement,
  ClassDeclaration,
  ClassBody,
  MethodDefinition,
  DebuggerStatement,
  SwitchStatement,
  DoWhileStatement
};
