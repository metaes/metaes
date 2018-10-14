import { Environment, SetValue, GetValue } from "./environment";
import { Apply, GetProperty, Identifier, Literal, SetProperty } from "./interpreter/base";
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
  TemplateLiteral,
  ThisExpression,
  UnaryExpression,
  UpdateExpression
} from "./interpreter/expressions";
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

export const ecmaScriptInterpreters: Environment = {
  values: {
    GetProperty,
    SetProperty,
    Apply,
    Identifier,
    Literal,

    SetValue,
    GetValue,

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
