export interface NodeLoc {
  start: { column: number, line: number };
  end: { column: number, line: number };
}

export interface NodeBase {
  loc: NodeLoc;
  range: [number, number];
}

export type ASTNode = NodeBase &
  {
    type: any
  };

export function keyValueLooksLikeAnASTNode(astNode: ASTNode, key) {
  var value = astNode[key];
  return (
    key !== "range" &&
    value &&
    (Array.isArray(value) || (typeof value === "object" && "type" in value))
  );
}

export function getNodeChildrenNames(astNode: ASTNode): string[] {
  return Object.keys(astNode).filter(
    keyValueLooksLikeAnASTNode.bind(null, astNode)
  );
}

export function walkAst(ast: ASTNode, visitor: (node: ASTNode) => void) {
  function walkAstInner(ast: ASTNode) {
    if (Array.isArray(ast)) {
      for (var i = 0; i < ast.length; i++) {
        var childAst = ast[i];
        walkAstInner(childAst);
      }
    } else {
      visitor(ast);
      if (typeof ast === "object") {
        let names = getNodeChildrenNames(ast);
        for (var i = 0; i < names.length; i++) {
          walkAstInner(ast[names[i]]);
        }
      }
    }
  }

  walkAstInner(ast);
}
