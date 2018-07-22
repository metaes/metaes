import { evaluate, evaluateProp, evaluateArray, visitArray } from "../applyEval";
import { callInterceptor, getValue, setValue } from "../environment";
import { EvaluationConfig, MetaesException } from "../types";
import { NotImplementedException, LocatedError, LocatedException } from "../exceptions";
import { createMetaFunction } from "../metafunction";
import {
  BlockStatement as BlockStatement_,
  CatchClause,
  ClassBody,
  ClassDeclaration,
  ConditionalExpression,
  DebuggerStatement,
  EmptyStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  MethodDefinition,
  ObjectPattern,
  Program,
  ReturnStatement,
  Statement,
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement
} from "../nodeTypes";

function hoistDeclarations(e: Statement[], env, config, c, cerr) {
  visitArray(
    e.filter(e => e.type === "FunctionDeclaration") as FunctionDeclaration[],
    (e, c, cerr) => evaluate(e, env, config, value => setValue(env, e.id.name, value, true, c, cerr), cerr),
    c,
    cerr
  );
}

export function BlockStatement(e: BlockStatement_ | Program, env, config, c, cerr) {
  hoistDeclarations(
    e.body,
    env,
    config,
    () => evaluateProp("body", e, env, config, blockValues => c(blockValues[blockValues.length - 1]), cerr),
    cerr
  );
}

export function Program(e: Program, env, config, c, cerr) {
  BlockStatement(e, env, config, c, cerr);
}

type VariableDeclaratorValue = { id: string; init: any };

export function VariableDeclaration(e: VariableDeclaration, env, config, c, cerr) {
  visitArray(
    e.declarations,
    (declarator: VariableDeclarator, c, cerr) =>
      evaluate(
        declarator,
        env,
        config,
        ({ id, init }: VariableDeclaratorValue) => setValue(env, id, init, true, c, cerr),
        cerr
      ),
    c,
    cerr
  );
}

export function VariableDeclarator(e: VariableDeclarator, env, config, c, cerr) {
  switch (e.id.type) {
    case "Identifier":
      if (e.init) {
        evaluateProp(
          "init",
          e,
          env,
          config,
          init => {
            const v = {
              id: (e.id as Identifier).name,
              init
            };
            // TODO: handle _error, it may happen in the future with redeclaration of `let/const` Reference
            const cnt = (_exception?: MetaesException) => {
              // undefined as value, because Identifier at this point doesn't represent a Reference.
              // It does after VariableDeclarator finishes.
              callInterceptor({ phase: "exit" }, config, e.id, env);
              c(v);
            };
            evaluate(e.id, env, config, cnt, cnt);
          },
          cerr
        );
      } else {
        const value = {
          id: e.id.name,
          init: undefined
        };
        const cnt = () => {
          callInterceptor({ phase: "exit" }, config, e.id, env);
          c(value);
        };
        evaluate(e.id, env, config, cnt, cnt);
      }
      break;
    case "ObjectPattern":
      evaluateProp(
        "init",
        e,
        env,
        config,
        init => {
          if (!init) {
            cerr(LocatedException("Cannot match against falsy value.", e.init));
          } else {
            const results: VariableDeclaratorValue[] = [];
            for (let id of (e.id as ObjectPattern).properties) {
              switch (id.key.type) {
                case "Identifier":
                  const key = id.key.name;
                  results.push({ id: key, init: init[key] });
                  break;
                default:
                  return cerr(NotImplementedException(`'${id.key.type}' in '${e.type}' is not supported yet.`));
              }
            }
            c(results);
          }
        },
        cerr
      );
      break;
    default:
      cerr(NotImplementedException(`Pattern ${e.type} is not supported yet.`, e));
  }
}

export function IfStatement(e: IfStatement | ConditionalExpression, env, config, c, cerr) {
  evaluateProp(
    "test",
    e,
    env,
    config,
    test => {
      if (test) {
        evaluateProp("consequent", e, env, config, c, cerr);
      } else if (e.alternate) {
        evaluateProp("alternate", e, env, config, c, cerr);
      } else {
        c();
      }
    },
    cerr
  );
}

export function ExpressionStatement(e: ExpressionStatement, env, config, c, cerr) {
  evaluateProp("expression", e, env, config, c, cerr);
}

export function TryStatement(e: TryStatement, env, config: EvaluationConfig, c, cerr) {
  evaluateProp("block", e, env, config, c, exception =>
    evaluateProp(
      "handler",
      e,
      {
        values: {
          // Use name which is illegal JavaScript identifier.
          // It will disallow collision with user names.
          "/exception": exception.value
        },
        prev: env
      },
      config,
      () => (e.finalizer ? evaluateProp("finalizer", e, env, config, c, cerr) : c()),
      cerr
    )
  );
}

export function ThrowStatement(e: ThrowStatement, env, config, _c, cerr) {
  evaluateProp("argument", e, env, config, value => cerr({ type: "ThrowStatement", value, location: e }), cerr);
}

export function CatchClause(e: CatchClause, env, config, c, cerr) {
  getValue(
    env,
    "/exception",
    error =>
      evaluateProp(
        "body",
        e,
        {
          values: { [e.param.name]: error },
          prev: env
        },
        config,
        c,
        cerr
      ),
    cerr
  );
}

export function ReturnStatement(e: ReturnStatement, env, config, _c, cerr) {
  if (e.argument) {
    evaluateProp("argument", e, env, config, value => cerr({ type: "ReturnStatement", value }), cerr);
  } else {
    cerr({ type: "ReturnStatement" });
  }
}

export function FunctionDeclaration(e: FunctionDeclaration, env, config, c, cerr) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ForInStatement(e: ForInStatement, env, config, c, cerr) {
  evaluate(
    e.right,
    env,
    config,
    right => {
      const leftNode = e.left;
      if (leftNode.type === "Identifier") {
        const names = Object.keys(right);
        visitArray(
          names,
          (name, c, cerr) =>
            setValue(
              env,
              leftNode.name,
              name,
              false,
              value => (
                callInterceptor({ phase: "exit" }, config, leftNode, env, value), evaluate(e.body, env, config, c, cerr)
              ),
              cerr
            ),
          c,
          cerr
        );
      } else {
        cerr(NotImplementedException("Only identifier in left-hand side is supported now."));
      }
    },
    cerr
  );
}

export function ForStatement(e: ForStatement, env, config, _c, cerr) {
  evaluate(
    e.init,
    env,
    config,
    _init => {
      debugger;
    },
    cerr
  );
}

export function ForOfStatement(e: ForOfStatement, env, config, c, cerr) {
  evaluate(
    e.right,
    env,
    config,
    right => {
      switch (e.left.type) {
        case "VariableDeclaration":
          const loopEnv = {
            prev: env,
            values: {}
          };
          // create iterator in new env
          evaluate(
            e.left,
            loopEnv,
            config,
            (left: VariableDeclaratorValue[]) =>
              visitArray(
                right,
                (rightItem, c, cerr) =>
                  // TODO: iterate over declarations in e.left
                  setValue(
                    env,
                    left[0].id,
                    rightItem,
                    false,
                    value => {
                      callInterceptor({ phase: "exit" }, config, e.left, env, value);
                      evaluate(e.body, loopEnv, config, c, e => {
                        cerr(e);
                      });
                    },
                    cerr
                  ),
                c,
                cerr
              ),
            cerr
          );
          break;
        default:
          cerr(NotImplementedException(`Left-hand side of type ${e.left.type} in ${e.type} not implemented yet.`));
          break;
      }
    },
    cerr
  );
}

export function WhileStatement(e: WhileStatement, env, config, c, cerr) {
  (function loop() {
    evaluate(e.test, env, config, test => (test ? evaluate(e.body, env, config, c, cerr) : c()), cerr);
  })();
}

export function EmptyStatement(_e: EmptyStatement, _env, _config, c) {
  c();
}

// TODO: clean up, fix error
export function ClassDeclaration(e: ClassDeclaration, env, config, c, cerr) {
  evaluate(
    e.superClass,
    env,
    config,
    superClass =>
      evaluate(
        e.body,
        env,
        config,
        body =>
          visitArray(
            body,
            ({ key, value }, c, cerr) => {
              if (key === "constructor") {
                value.prototype = Object.create(superClass.prototype);
                if (e.id) {
                  setValue(
                    env,
                    e.id.name,
                    value,
                    true,
                    value => (callInterceptor({ phase: "exit" }, config, e.id!, env, value), c(value)),
                    cerr
                  );
                } else {
                  cerr(NotImplementedException("Not implemented case"));
                }
              } else {
                cerr(NotImplementedException("Methods handling not implemented yet."));
              }
            },
            c,
            cerr
          ),
        cerr
      ),
    cerr
  );
}

export function ClassBody(e: ClassBody, env, config, c, cerr) {
  evaluateArray(e.body, env, config, c, cerr);
}

export function MethodDefinition(e: MethodDefinition, env, config, c, cerr) {
  evaluate(
    e.value,
    env,
    config,
    value => {
      if (e.kind === "constructor") {
        const key = e.key.name;
        c({ key, value });
      } else {
        cerr(NotImplementedException("Object methods not implemented yet."));
      }
    },
    cerr
  );
}

export function DebuggerStatement(_e: DebuggerStatement, _env, _config, c) {
  debugger;
  c();
}
