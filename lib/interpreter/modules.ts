import { GetValue, SetValue } from "../environment";
import { evaluate, visitArray } from "../evaluate";
import { NotImplementedException } from "../exceptions";
import * as NodeTypes from "../nodeTypes";
import { Environment } from "../types";

export function Identifier(e: NodeTypes.Identifier, c, cerr, env: Environment, config) {
  evaluate(
    { type: "GetValue", name: e.name },
    (value) =>
      value instanceof ImportBinding
        ? evaluate(
            { type: "GetValue", name: "[[GetBindingValue]]" },
            (getBindingValue) => getBindingValue(value, c, cerr, env, config),
            cerr,
            env,
            config
          )
        : c(value),
    (exception) => {
      exception.location = e;
      cerr(exception);
    },
    env,
    config
  );
}

export const ImportEnvironmentSymbol = "[[isImportModule]]";
export const ExportEnvironmentSymbol = "[[isExportModule]]";

export function ExportNamedDeclaration(e: NodeTypes.ExportNamedDeclaration, c, cerr, env: Environment, config) {
  evaluate(
    e.declaration,
    (value) => {
      let name: string;

      switch (e.declaration.type) {
        case "FunctionDeclaration":
          name = e.declaration.id.name;
          break;

        case "ClassDeclaration":
          name = e.declaration.id.name;
          break;

        case "VariableDeclaration": {
          switch (e.declaration.declarations[0].id.type) {
            case "Identifier":
              name = e.declaration.declarations[0].id.name;
              break;
            default:
              return cerr(
                NotImplementedException(
                  `'${e.declaration.declarations[0].id.type}' declaration id type is not supported.`,
                  e.declaration
                )
              );
          }

          break;
        }
        default:
          return cerr(
            NotImplementedException(
              `'${e.declaration["type"]}' declaration type export is not supported.`,
              e.declaration
            )
          );
      }
      GetValue(
        { name: "[[ExportBinding]]" },
        (exportBinding) => exportBinding({ name, value, e: e.declaration }, c, cerr, env, config),
        cerr,
        env
      );
    },
    cerr,
    env,
    config
  );
}

export function ExportDefaultDeclaration(e: NodeTypes.ExportDefaultDeclaration, c, cerr, env, config) {
  evaluate(
    e.declaration,
    (value) =>
      GetValue(
        { name: "[[ExportBinding]]" },
        (exportBinding) => exportBinding({ name: "default", value, e: e.declaration }, c, cerr, env, config),
        cerr,
        env
      ),
    cerr,
    env,
    config
  );
}

export class ImportBinding {
  constructor(public name: string, public modulePath: string) {}
}

export function ImportDeclaration(e: NodeTypes.ImportDeclaration, c, cerr, env, config) {
  visitArray(
    e.specifiers,
    (specifier, c, cerr) => {
      const name = specifier.local.name;
      SetValue({ name, value: new ImportBinding(name, e.source.value), isDeclaration: true }, c, cerr, env);
    },
    c,
    cerr
  );
}

export default {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ImportDeclaration,
  Identifier
};
