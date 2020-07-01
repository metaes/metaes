import { getEnvironmentBy, GetValue, SetValue } from "../environment";
import { evaluate, visitArray } from "../evaluate";
import { LocatedError, NotImplementedException } from "../exceptions";
import * as NodeTypes from "../nodeTypes";
import { Environment } from "../types";

export const ImportEnvironmentSymbol = "[[isImportModule]]";
export const ExportEnvironmentSymbol = "[[isExportModule]]";

export function ExportNamedDeclaration(e: NodeTypes.ExportNamedDeclaration, c, cerr, env: Environment, config) {
  evaluate(
    e.declaration,
    (value) => {
      const exportEnv = getEnvironmentBy(env, (env) => env[ExportEnvironmentSymbol]);
      if (!exportEnv) {
        cerr(
          LocatedError(
            `Couldn't export declaration, no environment with '${ExportEnvironmentSymbol}' property found.`,
            e.declaration
          )
        );
        return;
      }
      switch (e.declaration.type) {
        case "FunctionDeclaration":
          evaluate(
            { type: "SetValue", name: e.declaration.id.name, value, isDeclaration: true },
            c,
            cerr,
            exportEnv!,
            config
          );
          break;

        case "VariableDeclaration": {
          evaluate(
            { type: "SetValue", name: e.declaration.declarations[0].id.name, value, isDeclaration: true },
            c,
            cerr,
            exportEnv!,
            config
          );
          break;
        }
        default:
          cerr(
            NotImplementedException(
              `'${e.declaration["type"]}' declaration type export is not supported.`,
              e.declaration
            )
          );
      }
    },
    cerr,
    env,
    config
  );
}

export function ImportDeclaration(e: NodeTypes.ImportDeclaration, c, cerr, env, config) {
  GetValue(
    { name: "import" },
    async (importFn) => {
      try {
        const importedModule = await importFn(e.source.value);
        visitArray(
          e.specifiers,
          (specifier, c, cerr) => {
            const name = specifier.local.name;
            SetValue({ name, value: importedModule[name], isDeclaration: true }, c, cerr, env);
          },
          c,
          cerr
        );
      } catch (e) {
        cerr(e);
      }
    },
    cerr,
    env
  );
}

export default {
  ExportNamedDeclaration,
  ImportDeclaration
};
