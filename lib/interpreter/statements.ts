import { evaluate, evaluateArray, evaluateArrayAsync } from "../applyEval";
import { callInterceptor, getValue, setValue, setValueAndCallAfterInterceptor } from "../environment";
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
  evaluateArrayAsync(
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
    () => evaluateArray(e.body, env, config, blockValues => c(blockValues[blockValues.length - 1]), cerr),
    cerr
  );
}

export function Program(e: Program, env, config, c, cerr) {
  BlockStatement(e, env, config, c, cerr);
}

type VariableDeclaratorValue = { id: string; init: any };

export function VariableDeclaration(e: VariableDeclaration, env, config, c, cerr) {
  evaluateArrayAsync(
    e.declarations,
    (declarator: VariableDeclarator, c, cerr) => {
      evaluate(
        declarator,
        env,
        config,
        (result: VariableDeclaratorValue) => {
          let { id, init } = result;
          setValue(env, id, init, true, c, cerr);
        },
        cerr
      );
    },
    c,
    cerr
  );
}

export function VariableDeclarator(e: VariableDeclarator, env, config, c, cerr) {
  switch (e.id.type) {
    case "Identifier":
      if (e.init) {
        evaluate(
          e.init,
          env,
          config,
          init => {
            let v = {
              id: (e.id as Identifier).name,
              init
            };
            // TODO: handle _error, it may happen in the future with redeclaration of `let/const` Reference
            let cnt = (_exception?: MetaesException) => {
              // undefined as value, because Identifier at this point doesn't represent a Reference.
              // It does after VariableDeclarator finishes.
              callInterceptor(e.id, config, undefined, env, "exit");
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
          callInterceptor(e.id, config, undefined, env, "exit");
          c(value);
        };
        evaluate(e.id, env, config, cnt, cnt);
      }
      break;
    case "ObjectPattern":
      evaluate(
        e.init,
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
                  cerr(NotImplementedException(`'${id.key.type}' in '${e.type}' is not supported yet.`));
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
  evaluate(
    e.test,
    env,
    config,
    test => {
      if (test) {
        evaluate(e.consequent, env, config, c, cerr);
      } else if (e.alternate) {
        evaluate(e.alternate, env, config, c, cerr);
      } else {
        c();
      }
    },
    cerr
  );
}

export function ExpressionStatement(e: ExpressionStatement, env, config, c, cerr) {
  evaluate(e.expression, env, config, c, cerr);
}

export function TryStatement(e: TryStatement, env, config: EvaluationConfig, c, cerr) {
  evaluate(e.block, env, config, c, exception => {
    if (exception.type === "ReturnStatement") {
      cerr(exception);
    } else {
      config.onError && config.onError(exception);
      evaluate(
        e.handler,
        // Use name which is illegal JavaScript identifier.
        // It will disallow collision with user names.
        { values: { "/exception": exception.value }, prev: env },
        config,
        () => (e.finalizer ? evaluate(e.finalizer, env, config, c, cerr) : c()),
        cerr
      );
    }
  });
}

export function ThrowStatement(e: ThrowStatement, env, config, _c, cerr) {
  evaluate(e.argument, env, config, value => cerr({ type: "ThrowStatement", value, location: e }), cerr);
}

export function CatchClause(e: CatchClause, env, config, c, cerr) {
  getValue(
    env,
    "/exception",
    error => {
      let name = e.param.name;
      evaluate(
        e.body,
        {
          values: { [name]: error },
          prev: env
        },
        config,
        c,
        cerr
      );
    },
    cerr
  );
}

export function ReturnStatement(e: ReturnStatement, env, config, _c, cerr) {
  if (e.argument) {
    evaluate(e.argument, env, config, value => cerr({ type: "ReturnStatement", value }), cerr);
  } else {
    cerr({ type: "ReturnStatement" });
  }
}

// TODO: don't use try/catch here, use cerr directly instead
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
      let leftNode = e.left;
      if (leftNode.type === "Identifier") {
        let names = Object.keys(right);

        evaluateArrayAsync(
          names,
          (name, c, cerr) =>
            setValueAndCallAfterInterceptor(
              leftNode,
              env,
              config,
              leftNode.name,
              name,
              false,
              () => evaluate(e.body, env, config, c, cerr),
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
          let loopEnv = {
            prev: env,
            values: {}
          };
          // create iterator in new env
          evaluate(
            e.left,
            loopEnv,
            config,
            (left: VariableDeclaratorValue[]) =>
              evaluateArrayAsync(
                right,
                (rightItem, c, cerr) =>
                  // TODO: iterate over declarations in e.left
                  setValueAndCallAfterInterceptor(
                    e.left,
                    loopEnv,
                    config,
                    left[0].id,
                    rightItem,
                    false,
                    () =>
                      evaluate(e.body, loopEnv, config, c, e => {
                        cerr(e);
                        throw e;
                      }),
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
          evaluateArrayAsync(
            body,
            ({ key, value }, c, cerr) => {
              if (key === "constructor") {
                value.prototype = Object.create(superClass.prototype);
                if (e.id) {
                  setValueAndCallAfterInterceptor(e.id, env, config, e.id.name, value, true, c, cerr);
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
        let key = e.key.name;
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
