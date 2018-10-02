import {
  BlockStatement,
  CatchClause,
  ClassBody,
  ClassDeclaration,
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
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement
} from "./interpreter/statements";
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
} from "./interpreter/expressions";
import { Identifier, Literal, GetProperty, SetProperty } from "./interpreter/base";
import { Environment } from "./environment";

export const ecmaScriptInterpreters: Environment = {
  values: {
    GetProperty,
    SetProperty,
    Identifier,
    Literal,

    // statements
    Program,
    BlockStatement,
    IfStatement,
    ExpressionStatement,
    TryStatement,
    ThrowStatement,
    CatchClause,
    VariableDeclaration,
    VariableDeclarator,
    ReturnStatement,
    FunctionDeclaration,
    ForInStatement,
    ForOfStatement,
    WhileStatement,
    ForStatement,
    EmptyStatement,
    ClassDeclaration,
    ClassBody,
    DebuggerStatement,

    // expressions
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
    UnaryExpression,
    UpdateExpression,
    ThisExpression,
    ConditionalExpression,
    MethodDefinition,
    TemplateLiteral
  }
};
