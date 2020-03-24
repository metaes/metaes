import { getEnvironmentBy } from "../environment";
import { evaluate } from "../evaluate";
import { LocatedError, NotImplementedException } from "../exceptions";
import * as NodeTypes from "../nodeTypes";
import { Environment } from "../types";

export const ImportEnvironmentSymbol = "[[isImportModule]]";
export const ExportEnvironmentSymbol = "[[isExportModule]]";

export function ExportNamedDeclaration(e: NodeTypes.ExportNamedDeclaration, c, cerr, env: Environment, config) {
  evaluate(
    e.declaration,
    value => {
      if (e.declaration.type === "FunctionDeclaration") {
        const exportEnv = getEnvironmentBy(env, env => env[ExportEnvironmentSymbol]);
        if (exportEnv) {
          evaluate(
            { type: "SetValue", name: e.declaration.id.name, value, isDeclaration: true },
            c,
            cerr,
            exportEnv,
            config
          );
        } else {
          cerr(
            LocatedError(
              `Couldn't export declaration, no environment with '${ExportEnvironmentSymbol}' property found.`,
              e.declaration
            )
          );
        }
      } else {
        cerr(
          NotImplementedException(`'${e.declaration.type}' declaration type export is not supported.`, e.declaration)
        );
      }
    },
    cerr,
    env,
    config
  );
}

export default {
  ExportNamedDeclaration
};
