import { evaluate, evaluateArray, visitArray } from "../applyEval";
import { GetValue } from "../environment";
import { LocatedError, NotImplementedException } from "../exceptions";
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
  Program,
  ReturnStatement,
  Statement,
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement
} from "../nodeTypes";
import { EvaluationConfig } from "../types";

function hoistDeclarations(e: Statement[], c, cerr, env, config) {
  visitArray(
    e.filter(e => e.type === "FunctionDeclaration") as FunctionDeclaration[],
    (e, c, cerr) =>
      evaluate(
        e,
        value => evaluate({ type: "SetValue", name: e.id.name, value, isDeclaration: true }, c, cerr, env, config),
        cerr,
        env,
        config
      ),
    c,
    cerr
  );
}

export function BlockStatement(e: BlockStatement_ | Program, c, cerr, env, config) {
  hoistDeclarations(
    e.body,
    () => evaluateArray(e.body, blockValues => c(blockValues[blockValues.length - 1]), cerr, env, config),
    cerr,
    env,
    config
  );
}

export function Program(e: Program, c, cerr, env, config) {
  BlockStatement(e, c, cerr, env, config);
}

export function VariableDeclaration(e: VariableDeclaration, c, cerr, env, config) {
  visitArray(
    e.declarations,
    (declarator: VariableDeclarator, c, cerr) => evaluate(declarator, c, cerr, env, config),
    c,
    cerr
  );
}

export function VariableDeclarator(e: VariableDeclarator, c, cerr, env, config) {
  function id(initValue) {
    switch (e.id.type) {
      case "Identifier":
        evaluate({ type: "SetValue", name: e.id.name, value: initValue, isDeclaration: true }, c, cerr, env, config);
        break;
      default:
        cerr(NotImplementedException(`Init ${e.id.type} is not supported yet.`, e));
    }
  }
  e.init ? evaluate(e.init, id, cerr, env, config) : id(undefined);
}

export function IfStatement(e: IfStatement | ConditionalExpression, c, cerr, env, config) {
  evaluate(
    e.test,
    test => {
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
}

export function ExpressionStatement(e: ExpressionStatement, c, cerr, env, config) {
  evaluate(e.expression, c, cerr, env, config);
}

export function TryStatement(e: TryStatement, c, cerr, env, config: EvaluationConfig) {
  evaluate(
    e.block,
    c,
    exception =>
      evaluate(
        e.handler,
        () => (e.finalizer ? evaluate(e.finalizer, c, cerr, env, config) : c()),
        cerr,
        {
          values: {
            // Use name which is illegal JavaScript identifier.
            // It will disallow collision with user names.
            "/exception": exception.value
          },
          prev: env
        },
        config
      ),
    env,
    config
  );
}

export function ThrowStatement(e: ThrowStatement, _c, cerr, env, config) {
  evaluate(e.argument, value => cerr({ type: "ThrowStatement", value, location: e }), cerr, env, config);
}

export function CatchClause(e: CatchClause, c, cerr, env, config) {
  GetValue(
    { name: "/exception" },
    error =>
      evaluate(
        e.body,
        c,
        cerr,
        {
          values: { [e.param.name]: error },
          prev: env
        },
        config
      ),
    cerr,
    env
  );
}

export function ReturnStatement(e: ReturnStatement, _c, cerr, env, config) {
  e.argument
    ? evaluate(e.argument, value => cerr({ type: "ReturnStatement", value }), cerr, env, config)
    : cerr({ type: "ReturnStatement" });
}

export function FunctionDeclaration(e: FunctionDeclaration, c, cerr, env, config) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ForInStatement(e: ForInStatement, c, cerr, env, config) {
  evaluate(
    e.right,
    right => {
      const leftNode = e.left;
      if (leftNode.type === "Identifier") {
        visitArray(
          Object.keys(right),
          (name, c, cerr) =>
            evaluate(
              { type: "SetValue", name: leftNode.name, value: name, isDeclaration: false },
              () => evaluate(e.body, c, cerr, env, config),
              cerr,
              env,
              config
            ),
          c,
          cerr
        );
      } else {
        cerr(NotImplementedException("Only identifier in left-hand side is supported now."));
      }
    },
    cerr,
    env,
    config
  );
}

export function ForStatement(e: ForStatement, _c, cerr, env, config) {
  evaluate(e.init, _init => cerr(NotImplementedException(`${e.type} is not implemented yet`)), cerr, env, config);
}

export const ForOfBinding = "-metaes-for-of-binding";

export function ForOfStatement(e: ForOfStatement, c, cerr, env, config) {
  evaluate(
    e.right,
    right => {
      if (!Array.isArray(right)) {
        cerr(NotImplementedException("Only arrays as right-hand side of for-of loop are supported for now.", e.right));
      } else {
        switch (e.left.type) {
          case "VariableDeclaration":
            // create iterator in new env
            evaluate(
              e.left,
              _ =>
                // TODO: iterate over declarations in e.left
                visitArray(
                  right,
                  (rightItem, c, cerr) => {
                    const bodyEnv = {
                      prev: env,

                      /**
                       * Metaes script inaccessible environment variable binding current item of iterable expression.
                       * It purposedly has ECMAScript incorrect identifier value.
                       * Can be used by any kind of evaluation observers.
                       */
                      values: { [ForOfBinding]: rightItem }
                    };

                    /**
                     * TODO: currently left-hand side of loop definition is bound to new environment
                     * for each iteration. It means it supports `let`/`const` style (creates new scope),
                     * but not `var` (where shouldn't be created).
                     *
                     * Should support both semantics.
                     */
                    evaluate(
                      {
                        type: "SetValue",
                        name: (<Identifier>e.left.declarations[0].id).name,
                        value: rightItem,
                        isDeclaration: true
                      },
                      () => evaluate(e.body, c, cerr, bodyEnv, config),
                      cerr,
                      bodyEnv,
                      config
                    );
                  },
                  c,
                  cerr
                ),
              cerr,
              env,
              config
            );
            break;
          default:
            cerr(NotImplementedException(`Left-hand side of type ${e.left.type} in ${e.type} not implemented yet.`));
            break;
        }
      }
    },
    cerr,
    env,
    config
  );
}

export function WhileStatement(e: WhileStatement, c, cerr, env, config) {
  (function loop() {
    evaluate(e.test, test => (test ? evaluate(e.body, loop, cerr, env, config) : c()), cerr, env, config);
  })();
}

export function EmptyStatement(_e: EmptyStatement, c) {
  c();
}

// TODO: clean up, fix error
export function ClassDeclaration(e: ClassDeclaration, c, cerr, env, config) {
  evaluate(
    e.superClass,
    superClass =>
      evaluate(
        e.body,
        body =>
          visitArray(
            body,
            ({ key, value }, c, cerr) => {
              if (key === "constructor") {
                value.prototype = Object.create(superClass.prototype);
                if (e.id) {
                  evaluate({ type: "SetValue", name: e.id.name, value, isDeclaration: true }, c, cerr, env, config);
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
        cerr,
        env,
        config
      ),
    cerr,
    env,
    config
  );
}

export function ClassBody(e: ClassBody, c, cerr, env, config) {
  evaluateArray(e.body, c, cerr, env, config);
}

export function MethodDefinition(e: MethodDefinition, c, cerr, env, config) {
  evaluate(
    e.value,
    value =>
      e.kind === "constructor"
        ? c({ key: e.key.name, value })
        : cerr(NotImplementedException("Object methods not implemented yet.")),
    cerr,
    env,
    config
  );
}

export function DebuggerStatement(_e: DebuggerStatement, c) {
  debugger;
  c();
}
