import { getEnvironmentBy, GetValue, SetValue } from "../environment";
import { evaluate, visitArray } from "../evaluate";
import { LocatedException, NotImplementedException } from "../exceptions";
import * as NodeTypes from "../nodeTypes";
import { Environment, Interpreter } from "../types";

export const ImportEnvironment = "[[isImportModule]]";
export const ExportEnvironment = "[[isExportModule]]";
export const GetBindingValue = "[[GetBindingValue]]";
export const ImportModule = "[[ImportModule]]";
export const ExportBinding = "[[ExportBinding]]";

export const modulesEnv = {
  [GetBindingValue](value: ImportBinding, c, cerr, env: Environment) {
    GetValue(
      { name: ImportModule },
      (importTSModule) =>
        importTSModule(value.modulePath)
          .then((mod) => c(mod[value.name]))
          .catch(cerr),
      cerr,
      env
    );
  },
  [ExportBinding]({ name, value, e }, c, cerr, env, config) {
    const exportEnv = getEnvironmentBy(env, (env) => env[ExportEnvironment]);
    if (!exportEnv) {
      return cerr(
        LocatedException(
          `Couldn't export declaration, no environment with '${ExportEnvironment}' property found.`,
          e.declaration
        )
      );
    }
    evaluate({ type: "SetValue", name, value, isDeclaration: true }, c, cerr, exportEnv, config);
  }
};

export const Identifier: Interpreter<NodeTypes.Identifier> = (e, c, cerr, env, config) =>
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

export const ExportNamedDeclaration: Interpreter<NodeTypes.ExportNamedDeclaration> = (
  e,
  c,
  cerr,
  env: Environment,
  config
) =>
  evaluate(
    e.declaration,
    (value) => {
      let toExport;
      let name: string;

      switch (e.declaration.type) {
        case "FunctionDeclaration":
        case "ClassDeclaration":
          name = e.declaration.id.name;
          toExport = value;
          break;

        case "VariableDeclaration": {
          switch (e.declaration.declarations[0].id.type) {
            case "Identifier":
              name = e.declaration.declarations[0].id.name;
              toExport = value[0];
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
        { name: ExportBinding },
        (exportBinding) => exportBinding({ name, value: toExport, e: e.declaration }, c, cerr, env, config),
        cerr,
        env
      );
    },
    cerr,
    env,
    config
  );

export const ExportDefaultDeclaration: Interpreter<NodeTypes.ExportDefaultDeclaration> = (e, c, cerr, env, config) =>
  evaluate(
    e.declaration,
    (value) =>
      GetValue(
        { name: ExportBinding },
        (exportBinding) => exportBinding({ name: "default", value, e: e.declaration }, c, cerr, env, config),
        cerr,
        env
      ),
    cerr,
    env,
    config
  );

export class ImportBinding {
  constructor(public name: string, public modulePath: string) {}
}

export const ImportDeclaration: Interpreter<NodeTypes.ImportDeclaration> = (e, c, cerr, env) =>
  visitArray(
    e.specifiers,
    (specifier, c, cerr) => {
      const name = specifier.local.name;
      const modulePath = <string>e.source.value;

      switch (specifier.type) {
        case "ImportNamespaceSpecifier":
          SetValue({ name, value: new ImportBinding("default", modulePath), isDeclaration: true }, c, cerr, env);
          break;
        case "ImportSpecifier":
          SetValue({ name, value: new ImportBinding(name, modulePath), isDeclaration: true }, c, cerr, env);
          break;
        case "ImportDefaultSpecifier":
          SetValue({ name, value: new ImportBinding("default", modulePath), isDeclaration: true }, c, cerr, env);
          break;
        default:
          cerr(NotImplementedException(`${specifier["type"]} import specifier is not supported yet.`, specifier));
          break;
      }
    },
    c,
    cerr
  );

export default {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ImportDeclaration,
  Identifier
};
