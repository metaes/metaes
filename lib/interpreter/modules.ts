import { evaluate } from "../evaluate";
import * as NodeTypes from "../nodeTypes";
import { Environment } from "../types";

export function ExportNamedDeclaration(e: NodeTypes.ExportNamedDeclaration, c, cerr, env: Environment, config) {
  evaluate(
    e.declaration,
    value =>
      e.declaration.type === "FunctionDeclaration"
        ? evaluate({ type: "SetValue", name: e.declaration.id.name, value, isDeclaration: true }, c, cerr, env, config)
        : c(value),
    cerr,
    env,
    config
  );
}

export default {
  ExportNamedDeclaration
};
