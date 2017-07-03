import {evaluate, evaluateArray, evaluateArrayAsync, ReturnStatementValue, ThrowStatementValue} from "../applyEval";
import {callInterceptor, getValue, setValue, setValueAndCallAfterInterceptor} from "../environment";
import {EvaluationConfig, LocatedError, NotImplementedYet} from "../types";
import {createMetaFunction} from "../metafunction";
import {errorShouldBeForwarded} from "../utils";
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
    e.filter(e => e.type === 'FunctionDeclaration') as FunctionDeclaration[],
    (e, c, cerr) => {
      evaluate(e, env, config,
        value => {
          setValue(env, e.id.name, value, true, c, cerr);
        },
        cerr);
    },
    c, cerr);
}

export function BlockStatement(e: BlockStatement_ | Program, env, config, c, cerr) {
  function errorHandler(e) {
    if (errorShouldBeForwarded(e)) {
      cerr(e);
    } else {
      c(e);
    }
  }

  hoistDeclarations(e.body, env, config, () => {
      evaluateArray(
        e.body,
        env,
        config,
        blockValues => c(blockValues[blockValues.length - 1]),
        errorHandler);
    },
    cerr);
}

export function Program(e: Program, env, config, c, cerr) {
  BlockStatement(e, env, config, c, cerr);
}

type VariableDeclaratorValue = { id: string, init: any };

export function VariableDeclaration(e: VariableDeclaration, env, config, c, cerr) {
  evaluateArrayAsync(e.declarations, (declarator: VariableDeclarator, c, cerr) => {
      evaluate(declarator, env, config, (result: VariableDeclaratorValue) => {
          let {id, init} = result;
          setValue(env, id, init, true, c, cerr);
        },
        cerr);
    },
    c, cerr);
}

export function VariableDeclarator(e: VariableDeclarator, env, config, c, cerr) {
  switch (e.id.type) {
    case 'Identifier':
      if (e.init) {
        evaluate(e.init, env, config, init => {
            let v = {
              id: (e.id as (Identifier)).name,
              init
            };
            // TODO: handle _error, it may happen in the future with redeclaration of `let/const` Reference
            let cnt = (_error?: Error) => {
              // undefined as value, because Identifier at this point doesn't represent a Reference.
              // It does after VariableDeclarator finishes.
              callInterceptor(e.id, config, undefined, env, 'exit');
              c(v);
            };
            evaluate(e.id, env, config, cnt, cnt);
          },
          cerr);
      } else {
        let value = {
          id: e.id.name,
          init: undefined
        };
        let cnt = () => {
          callInterceptor(e.id, config, undefined, env, 'exit');
          c(value);
        };
        evaluate(e.id, env, config, cnt, cnt);
      }
      break;
    case 'ObjectPattern':
      evaluate(e.init, env, config, init => {
          if (!init) {
            cerr(new LocatedError(e.init, new Error("Cannot match against falsy value.")))
          } else {
            let results: VariableDeclaratorValue[] = [];
            for (let id of (e.id as ObjectPattern).properties) {
              switch (id.key.type) {
                case 'Identifier':
                  let key = id.key.name;
                  results.push({id: key, init: init[key]});
                  break;
                default:
                  cerr(new NotImplementedYet(`'${id.key.type}' in '${e.type}' is not supported yet.`));
              }
            }
            c(results);
          }
        },
        cerr);
      break;
    default:
      cerr(new LocatedError(e, new Error(`Pattern ${e.type} is not supported yet.`)));
  }
}

export function IfStatement(e: IfStatement | ConditionalExpression, env, config, c, cerr) {
  evaluate(e.test, env, config, test => {
      if (test) {
        evaluate(e.consequent, env, config, c, cerr);
      } else if (e.alternate) {
        evaluate(e.alternate, env, config, c, cerr);
      } else {
        c();
      }
    },
    cerr)
}

export function ExpressionStatement(e: ExpressionStatement, env, config, c, cerr) {
  evaluate(e.expression, env, config, c, cerr)
}

export function TryStatement(e: TryStatement, env, config: EvaluationConfig, c, cerr) {
  evaluate(e.block, env, config, c,
    error => {
      if (errorShouldBeForwarded(error) && !(error instanceof ThrowStatementValue)) {
        cerr(error);
      } else {
        config.errorCallback(
          error instanceof LocatedError ?
            error :
            new LocatedError(e.block, error));

        let catchClauseEnv = {
          internal: {names: {error}},
          names: env.names,
          prev: env
        };
        evaluate(e.handler, catchClauseEnv, config, () => {
            if (e.finalizer) {
              return evaluate(e.finalizer, env, config, c, cerr);
            }
          },
          cerr);
      }
    });
}

export function ThrowStatement(e: ThrowStatement, env, config, _c, cerr) {
  evaluate(e.argument, env, config, cerr, cerr);
}

export function CatchClause(e: CatchClause, env, config, c, cerr) {
  getValue(env.internal, 'error',
    error => {
      let name = e.param.name;
      evaluate(e.body, {
        names: {[name]: error},
        prev: env
      }, config, c, cerr)
    },
    cerr);
}

export function ReturnStatement(e: ReturnStatement, env, config, _c, cerr) {
  if (e.argument) {
    evaluate(e.argument, env, config, value => {
        cerr(new ReturnStatementValue(value))
      },
      cerr);
  } else {
    cerr(new ReturnStatementValue(void 0));
  }
}

export function FunctionDeclaration(e: FunctionDeclaration, env, config, c, cerr) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(new LocatedError(e, error));
  }
}

export function ForInStatement(e: ForInStatement, env, config, c, cerr) {
  evaluate(e.right, env, config, right => {
      let leftNode = e.left;
      if (leftNode.type === 'Identifier') {
        let names = Object.keys(right);

        evaluateArrayAsync(names, (name, c, cerr) => {
          setValueAndCallAfterInterceptor(leftNode, env, config, leftNode.name, name, false,
            () => {
              evaluate(e.body, env, config, c, cerr)
            },
            cerr);
        }, c, cerr);
      } else {
        cerr(new NotImplementedYet("Only identifier in left-hand side is supported now."));
      }
    },
    cerr);
}


export function ForStatement(e: ForStatement, env, config, _c, cerr) {
  evaluate(e.init, env, config, _init => {
      debugger;
    },
    cerr);
}

export function ForOfStatement(e: ForOfStatement, env, config, c, cerr) {
  evaluate(e.right, env, config, right => {
      switch (e.left.type) {
        case "VariableDeclaration":
          let loopEnv = {
            prev: env,
            names: {}
          };
          // create iterator in new env
          evaluate(e.left, loopEnv, config, (left: VariableDeclaratorValue[]) => {
              evaluateArrayAsync(right, (rightItem, c, cerr) => {
                // TODO: iterate over declarations in e.left
                setValueAndCallAfterInterceptor(e.left, loopEnv, config, left[0].id, rightItem, false,
                  () => {
                    evaluate(e.body, loopEnv, config,
                      c,
                      e => {
                        cerr(e);
                        throw e;
                      });
                  },
                  cerr);
              }, c, cerr)
            },
            cerr);
          break;
        default:
          cerr(new NotImplementedYet(`Left-hand side of type ${e.left.type} in ${e.type} not implemented yet.`));
          break;
      }
    },
    cerr);
}

export function WhileStatement(e: WhileStatement, env, config, c, cerr) {
  function loop() {
    evaluate(e.test, env, config,
      test => {
        if (test) {
          evaluate(e.body, env, config,
            val => {
              if (errorShouldBeForwarded(val)) {
                cerr(val);
              } else {
                loop();
              }
            },
            cerr)
        } else {
          c();
        }
      },
      cerr);
  }

  loop();
}

export function EmptyStatement(_e: EmptyStatement, _env, _config, c) {
  c();
}

// TODO: clean up, fix error, avoid return statement here
export function ClassDeclaration(e: ClassDeclaration, env, config, c, cerr) {
  evaluate(e.superClass, env, config, superClass => {
      evaluate(e.body, env, config, body => {
          evaluateArrayAsync(body, ({key, value}, c, cerr) => {
            if (key === 'constructor') {
              value.prototype = Object.create(superClass.prototype);
              if (e.id) {
                setValueAndCallAfterInterceptor(e.id, env, config, e.id.name, value, true, c, cerr);
              }
            } else {
              cerr(new NotImplementedYet("Methods handling not implemented yet."));
            }
          }, c, cerr);
          // TODO: how to handle it?
          // cerr(new LocatedError(e.body, new NotImplementedYet(`Couldn't init properly this class yet.`)));
        },
        cerr);
    },
    cerr);
}

export function ClassBody(e: ClassBody, env, config, c, cerr) {
  evaluateArray(e.body, env, config, c, cerr)
}

export function MethodDefinition(e: MethodDefinition, env, config, c, cerr) {
  evaluate(e.value, env, config, value => {
      if (e.kind === 'constructor') {
        let key = e.key.name;
        c({key, value});
      } else {
        cerr(new NotImplementedYet("Object methods not implemented yet."));
      }
    },
    cerr);
}

export function DebuggerStatement(_e: DebuggerStatement, _env, _config, c) {
  debugger;
  c();
}
