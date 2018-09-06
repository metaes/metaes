import { evaluate, evaluateProp, evaluateArray, visitArray } from "../applyEval";
import { getValue, setValue } from "../environment";
import { EvaluationConfig } from "../types";
import { NotImplementedException, LocatedError } from "../exceptions";
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
  IfStatement,
  MethodDefinition,
  Program,
  ReturnStatement,
  Statement,
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement,
  Identifier
} from "../nodeTypes";
import { callInterceptor } from "../metaes";

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

export function VariableDeclaration(e: VariableDeclaration, env, config, c, cerr) {
  visitArray(
    e.declarations,
    (declarator: VariableDeclarator, c, cerr) => evaluate(declarator, env, config, c, cerr),
    c,
    cerr
  );
}

export function VariableDeclarator(e: VariableDeclarator, env, config, c, cerr) {
  function id(initValue) {
    switch (e.id.type) {
      case "Identifier":
        callInterceptor({ phase: "enter" }, config, e.id, env);
        setValue(
          env,
          e.id.name,
          initValue,
          true,
          value => (callInterceptor({ phase: "exit" }, config, e.id, env, value), c(value)),
          cerr
        );
        break;
      default:
        cerr(NotImplementedException(`Init ${e.id.type} is not supported yet.`, e));
    }
  }
  e.init ? evaluateProp("init", e, env, config, id, cerr) : id(undefined);
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
  e.argument
    ? evaluateProp("argument", e, env, config, value => cerr({ type: "ReturnStatement", value }), cerr)
    : cerr({ type: "ReturnStatement" });
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
        visitArray(
          Object.keys(right),
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
  evaluate(e.init, env, config, _init => cerr(NotImplementedException(`${e.type} is not implemented yet`)), cerr);
}

export function ForOfStatement(e: ForOfStatement, env, config, c, cerr) {
  evaluate(
    e.right,
    env,
    config,
    right => {
      switch (e.left.type) {
        case "VariableDeclaration":
          // create iterator in new env
          evaluate(
            e.left,
            env,
            config,
            _ =>
              // TODO: iterate over declarations in e.left
              visitArray(
                right,
                (rightItem, c, cerr) => {
                  const bodyEnv = {
                    prev: env,
                    values: {}
                  };
                  // TODO: currently left-hand side of loop definition is bound to new environment 
                  // for each iteration. It means it supports `let`/`const` style (creates new scope), 
                  // but not `var` (where shouldn't be created). 
                  //
                  // Should support both semantics.
                  setValue(
                    bodyEnv,
                    (<Identifier>e.left.declarations[0].id).name,
                    rightItem,
                    true,
                    value => {
                      callInterceptor({ phase: "exit" }, config, e.left, env, value);
                      evaluate(e.body, bodyEnv, config, c, cerr);
                    },
                    cerr
                  );
                },
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
    value =>
      e.kind === "constructor"
        ? c({ key: e.key.name, value })
        : cerr(NotImplementedException("Object methods not implemented yet.")),
    cerr
  );
}

export function DebuggerStatement(_e: DebuggerStatement, _env, _config, c) {
  debugger;
  c();
}
