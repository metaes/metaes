import { NodeBase } from "./types";

export interface Identifier extends NodeBase {
  type: "Identifier";
  name: string;
}
export interface Literal extends NodeBase {
  type: "Literal";
  value: string | number | boolean;
  regex?: {
    pattern: string;
    flags: string;
  };
}

export interface MemberExpression extends NodeBase {
  type: "MemberExpression";
  object: Expression;
  property: Expression;
  computed: boolean;
}

export interface Super extends NodeBase {
  type: "Super";
}

export interface CallExpression extends NodeBase {
  type: "CallExpression";
  callee:
    | Identifier
    | MemberExpression
    | CallExpression
    | FunctionExpression
    | Super
    | ArrowFunctionExpression
    | ConditionalExpression;
  arguments: Expression[];
}

export interface AssignmentExpression extends NodeBase {
  type: "AssignmentExpression";
  right: Expression;
  left: Identifier | MemberExpression | ObjectPattern;
  operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=" | "&=" | "|=" | "^=";
}

export interface ObjectExpression extends NodeBase {
  type: "ObjectExpression";
  properties: Property[];
}

export interface BinaryExpression extends NodeBase {
  type: "BinaryExpression";
  left: Expression;
  right: Expression;
  operator:
    | "+"
    | "-"
    | "==="
    | "=="
    | "!=="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">="
    | "*"
    | "/"
    | "instanceof"
    | "in"
    | "^"
    | "<<"
    | ">>"
    | ">>>"
    | "%"
    | "&"
    | "|";
}

export interface LogicalExpression extends NodeBase {
  type: "LogicalExpression";
  left: Expression;
  right: Expression;
  operator: "&&" | "||";
}

export interface UnaryExpression extends NodeBase {
  type: "UnaryExpression";
  argument: Expression;
  operator: "typeof" | "-" | "!" | "+" | "~" | "void" | "delete";
}

export interface UpdateExpression extends NodeBase {
  type: "UpdateExpression";
  prefix: boolean;
  operator: "++" | "--";
  argument: Expression;
}

export interface ArrayExpression extends NodeBase {
  type: "ArrayExpression";
  elements: Expression[];
}

export interface ArrayPattern extends NodeBase {
  type: "ArrayPattern";
  elements: (Identifier | RestElement)[];
}

export interface NewExpression extends NodeBase {
  type: "NewExpression";
  arguments: Identifier[];
  callee: MemberExpression | Identifier | CallExpression;
}

export interface SequenceExpression extends NodeBase {
  type: "SequenceExpression";
  expressions: Expression[];
}

export interface ThisExpression extends NodeBase {
  type: "ThisExpression";
}

export interface ConditionalExpression extends NodeBase {
  type: "ConditionalExpression";
  test: Expression;
  alternate: Expression;
  consequent: Expression;
}

export interface IfStatement extends NodeBase {
  type: "IfStatement";
  test: Expression;
  alternate: Expression | ExpressionStatement;
  consequent: Expression | ExpressionStatement;
}

export interface Property extends NodeBase {
  type: "Property";
  key: Identifier | Literal;
  value: Expression | ObjectPattern | AssignmentPattern;
  computed: boolean;
  shorthand: boolean;
  method: boolean;
  kind: "init";
}

export interface Program extends NodeBase {
  type: "Program";
  body: Statement[];
}

export interface BlockStatement extends NodeBase {
  type: "BlockStatement";
  body: Statement[];
}

export interface VariableDeclaration extends NodeBase {
  type: "VariableDeclaration";
  declarations: VariableDeclarator[];
}

export interface VariableDeclarator extends NodeBase {
  type: "VariableDeclarator";
  id: Identifier | ObjectPattern | ArrayPattern;
  init: Expression;
}

export interface AssignmentPattern extends NodeBase {
  type: "AssignmentPattern";
  left: Identifier;
  right: Expression;
}

export interface ObjectPattern extends NodeBase {
  type: "ObjectPattern";
  properties: Property[];
}

export interface ExpressionStatement extends NodeBase {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface TryStatement extends NodeBase {
  type: "TryStatement";
  block: BlockStatement;
  handler: CatchClause;
  finalizer?: BlockStatement;
}

export interface ThrowStatement extends NodeBase {
  type: "ThrowStatement";
  argument: Expression;
}

export interface CatchClause extends NodeBase {
  type: "CatchClause";
  param: Identifier;
  body: BlockStatement;
}

export interface ReturnStatement extends NodeBase {
  type: "ReturnStatement";
  argument?: Expression;
}

export interface BreakStatement extends NodeBase {
  type: "BreakStatement";
}

export interface ForInStatement extends NodeBase {
  type: "ForInStatement";
  left: Identifier;
  right: Expression;
  body: Statement;
}

export interface ForOfStatement extends NodeBase {
  type: "ForOfStatement";
  left: VariableDeclaration | Identifier;
  right: Expression;
  body: BlockStatement;
}

export interface WhileStatement extends NodeBase {
  type: "WhileStatement";
  body: BlockStatement;
  test: Expression;
}

export interface ForStatement extends NodeBase {
  type: "ForStatement";
  init: AssignmentExpression;
  test: Expression;
  update: Expression;
  body: BlockStatement;
}

export interface EmptyStatement extends NodeBase {
  type: "EmptyStatement";
}

export interface RestElement extends NodeBase {
  type: "RestElement";
  argument: Identifier;
}

interface FunctionParams {
  params: (Identifier | RestElement | ObjectPattern | AssignmentPattern)[];
}

export interface FunctionExpression extends NodeBase, FunctionParams {
  type: "FunctionExpression";
  id?: Identifier;
  params: (Identifier | RestElement)[];
  body: BlockStatement | Expression;
}

export interface FunctionDeclaration extends NodeBase, FunctionParams {
  type: "FunctionDeclaration";
  id: Identifier;
  body: BlockStatement;
  async: boolean;
}

export interface ArrowFunctionExpression extends NodeBase, FunctionParams {
  type: "ArrowFunctionExpression";
  body: BlockStatement | Expression;
}

export interface MethodDefinition extends NodeBase {
  type: "MethodDefinition";
  key: Identifier;
}

export interface ClassDeclaration extends NodeBase {
  type: "ClassDeclaration";
  id: Identifier;
  superClass: Identifier | null;
  body: ClassBody;
}

export interface ClassBody extends NodeBase {
  type: "ClassBody";
  body: MethodDefinition[];
}

export interface MethodDefinition extends NodeBase {
  type: "MethodDefinition";
  key: Identifier;
  computed: boolean;
  kind: "constructor";
  value: FunctionExpression;
}

export interface DebuggerStatement extends NodeBase {
  type: "DebuggerStatement";
}

export interface TemplateLiteral extends NodeBase {
  type: "TemplateLiteral";
  quasis: TemplateElement[];
  expressions: Expression[];
}

export interface TaggedTemplateExpression extends NodeBase {
  type: "TaggedTemplateExpression";
  tag: Expression;
  quasi: TemplateLiteral;
}

interface TemplateElement extends NodeBase {
  type: "TemplateElement";
  value: {
    raw: string;
    cooked: string;
  };
  tail: boolean;
}

export interface SpreadElement extends NodeBase {
  type: "SpreadElement";
  argument: Expression;
}

export interface AwaitExpression extends NodeBase {
  type: "AwaitExpression";
  argument: Expression;
}

export interface ExportNamedDeclaration extends NodeBase {
  type: "ExportNamedDeclaration";
  declaration: VariableDeclaration | FunctionDeclaration | ClassDeclaration;
}

export interface ExportDefaultDeclaration extends NodeBase {
  type: "ExportDefaultDeclaration";
  declaration: Expression;
}

export interface ImportDeclaration extends NodeBase {
  type: "ImportDeclaration";
  specifiers: (ImportSpecifier | ImportNamespaceSpecifier | ImportDefaultSpecifier)[];
  source: Literal;
}

interface ImportDefaultSpecifier extends NodeBase {
  type: "ImportDefaultSpecifier";
  local: Identifier;
}

interface ImportNamespaceSpecifier extends NodeBase {
  type: "ImportNamespaceSpecifier";
  local: Identifier;
}

interface ImportSpecifier extends NodeBase {
  type: "ImportSpecifier";
  local: Identifier;
  imported: Identifier;
}

export interface SwitchStatement extends NodeBase {
  type: "SwitchStatement";
  discriminant: Expression;
  cases: SwitchCase[];
}

interface SwitchCase extends NodeBase {
  type: "SwitchCase";
  test: Expression;
  consequent: Statement[];
}

export interface DoWhileStatement extends NodeBase {
  type: "DoWhileStatement";
  test: Expression;
  body: ExpressionStatement | Expression;
}

type ModuleNode = ExportNamedDeclaration | ImportDeclaration;

export type FunctionNode = FunctionExpression | FunctionDeclaration | ArrowFunctionExpression;

export type Statement =
  | FunctionDeclaration
  | Program
  | BlockStatement
  | VariableDeclaration
  | IfStatement
  | ExpressionStatement
  | TryStatement
  | ThrowStatement
  | CatchClause
  | ReturnStatement
  | ForInStatement
  | ForStatement
  | ForOfStatement
  | WhileStatement
  | EmptyStatement
  | ClassDeclaration
  | ClassBody
  | Super
  | DebuggerStatement
  | ModuleNode
  | SwitchStatement
  | DoWhileStatement;

type Expression =
  | Identifier
  | Literal
  | CallExpression
  | MemberExpression
  | FunctionExpression
  | ArrowFunctionExpression
  | AssignmentExpression
  | ObjectExpression
  | BinaryExpression
  | ArrayExpression
  | NewExpression
  | SequenceExpression
  | LogicalExpression
  | UnaryExpression
  | ThisExpression
  | ConditionalExpression
  | MethodDefinition
  | RestElement
  | TemplateLiteral
  | TaggedTemplateExpression
  | SpreadElement
  | AwaitExpression;

type Comment = Line;

export interface Line extends NodeBase {
  type: "Line";
}

export interface Apply extends NodeBase {
  type: "Apply";
  e: CallExpression;
  fn: Function;
  thisValue: any;
  args: any[];
}

export interface GetProperty extends NodeBase {
  type: "GetProperty";
  object: any;
  property: any;
}

export interface SetProperty extends NodeBase {
  type: "SetProperty";
  object: any;
  property: any;
  value: any;
  operator: string;
}

type Base = Apply | GetProperty | SetProperty;

export type JavaScriptASTNode =
  | Base
  | Expression
  | Property
  | Statement
  | VariableDeclarator
  | Comment
  | MethodDefinition;
