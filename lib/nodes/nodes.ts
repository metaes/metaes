export interface NodeLoc {
  start: { column: number; line: number };
  end: { column: number; line: number };
}

export interface NodeBase {
  loc?: NodeLoc;
  range?: [number, number];
}

export type ASTNode = NodeBase & {
  type: any;

  // Any other node specific props are allowed
  [key: string]: any;
};

const isNode = (node: ASTNode, key: string) => {
  const value = node[key];
  return key !== "range" && value && (Array.isArray(value) || (typeof value === "object" && "type" in value));
};

export const getNodeChildren = (node: ASTNode) =>
  Object.keys(node)
    .filter(isNode.bind(null, node))
    .map(name => ({ key: name, value: node[name] }));

export const walkTree = (node: ASTNode, visitor: (node: ASTNode) => void) =>
  (function _walkTree(node) {
    if (Array.isArray(node)) {
      node.forEach(_walkTree);
    } else {
      visitor(node);
      if (typeof node === "object") {
        getNodeChildren(node).forEach(({ value }) => _walkTree(value));
      }
    }
  })(node);
