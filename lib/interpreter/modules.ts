import { createEnvironment, getEnvironmentBy, GetValue } from "../environment";
import { at, declare, evaluate, get, getTrampolineScheduler, visitArray } from "../evaluate";
import { LocatedException, NotImplementedException, presentException } from "../exceptions";
import { bindArgs, metaesEvalModule, uncps } from "../metaes";
import * as NodeTypes from "../nodeTypes";
import { ASTNode, Continuation, Environment, ErrorContinuation, Interpreter, Interpreters, NodeLoc } from "../types";

export const ImportEnvironmentSymbol = "[[isImportModule]]";
export const ExportEnvironmentSymbol = "[[isExportModule]]";
export const GetBindingValueName = "[[GetBindingValue]]";
export const ImportModuleName = "[[ImportModule]]";
export const ExportBindingName = "[[ExportBinding]]";
export const CreateScriptName = "[[CreateScript]]";
export const ResolveModuleLocationName = "[[ResolveModuleLocation]]";
export const GetModuleSourceName = "[[GetModuleSource]]";

export const modulesEnv: Interpreters = {
  [GetBindingValueName](value: ImportBinding, c, cerr, env, config) {
    evaluate(
      at(value, get(ImportModuleName)),
      bindArgs(value.modulePath, (mod) => c(mod[value.name]), cerr),
      cerr,
      env,
      config
    );
  },
  [ExportBindingName]({ name, value, e }, c, cerr, env, config) {
    const exportEnv = getEnvironmentBy(env, (env) => env[ExportEnvironmentSymbol]);
    if (exportEnv) {
      evaluate(declare(name, value), c, cerr, exportEnv, config);
    } else {
      cerr(
        LocatedException(
          `Couldn't export declaration, no environment with '${ExportEnvironmentSymbol}' property found.`,
          e.declaration
        )
      );
    }
  }
};

export const Identifier: Interpreter<NodeTypes.Identifier> = (e, c, cerr, env, config) =>
  evaluate(
    // TODO: use `superi` for Identifier once bug in meta2 is solved.
    get(e.name),
    (value) =>
      value instanceof ImportBinding
        ? evaluate(at(e, get(GetBindingValueName)), bindArgs(value, c, cerr, env, config), cerr, env, config)
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
      evaluate(
        get(ExportBindingName),
        bindArgs({ name, value: toExport, e: e.declaration }, c, cerr, env, config),
        cerr,
        env,
        config
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
      evaluate(
        get(ExportBindingName),
        bindArgs({ name: "default", value, e: e.declaration }, c, cerr, env, config),
        cerr,
        env,
        config
      ),
    cerr,
    env,
    config
  );

export class ImportBinding implements ASTNode {
  type = "ImportBinding";

  loc?: NodeLoc;
  range?: [number, number];

  constructor(public name: string, public modulePath: string, location?: ASTNode) {
    if (location) {
      const { loc, range } = location;
      Object.assign(this, { loc, range });
    }
  }
}

export const ImportDeclaration: Interpreter<NodeTypes.ImportDeclaration> = (e, c, cerr, env, config) =>
  visitArray(
    e.specifiers,
    (specifier, c, cerr) => {
      const modulePath = <string>e.source.value;

      switch (specifier.type) {
        case "ImportNamespaceSpecifier":
        case "ImportDefaultSpecifier":
          evaluate(
            declare(specifier.local.name, new ImportBinding("default", modulePath, specifier)),
            c,
            cerr,
            env,
            config
          );
          break;
        case "ImportSpecifier":
          evaluate(
            declare(specifier.local.name, new ImportBinding(specifier.imported.name, modulePath, specifier)),
            c,
            cerr,
            env,
            config
          );
          break;
        default:
          cerr(NotImplementedException(`${specifier["type"]} import specifier is not supported yet.`, specifier));
          break;
      }
    },
    c,
    cerr
  );

const defaultResolveModuleLocation = (importerPath: string, importedPath: string) =>
  "./" + importerPath.substring(0, importerPath.lastIndexOf("/") + 1) + importedPath + ".js";

export function createModulesImporter(globalEnv: Environment) {
  const env = createEnvironment({}, globalEnv);
  const loadedModules = {};
  const loadingModules = {};

  function getVar(name: string, fallback?: any) {
    try {
      return uncps(GetValue)({ name }, globalEnv);
    } catch (e) {
      if (fallback) {
        return fallback;
      } else {
        throw e;
      }
    }
  }

  const resolveModuleLocation = getVar(ResolveModuleLocationName, defaultResolveModuleLocation);
  const getModuleSource = getVar(GetModuleSourceName);

  const importModuleLocalized = (basePath: string) => (path: string, c: Continuation, cerr: ErrorContinuation) => {
    if (path.startsWith("./") || path.startsWith("../")) {
      importModule(resolveModuleLocation(basePath, path), c, cerr);
    } else {
      if (loadedModules[path]) {
        c(loadedModules[path]);
      } else {
        getModuleSource(path, (mod) => c((loadedModules[path] = { ...mod, default: mod })), cerr);
      }
    }
  };

  function importModule(url: string, c: Continuation<{ [key: string]: any }>, cerr: ErrorContinuation) {
    if (loadedModules[url]) {
      c(loadedModules[url]);
    } else if (loadingModules[url]) {
      loadingModules[url].push({ c, cerr });
    } else {
      loadingModules[url] = [{ c, cerr }];
      GetValue(
        { name: CreateScriptName },
        bindArgs(
          url,
          (script) =>
            metaesEvalModule(
              script,
              function (mod) {
                const results = loadingModules[url];
                loadedModules[url] = mod;
                delete loadingModules[url];
                results.forEach(({ c }) => c(mod));
              },
              function (exception) {
                console.log(presentException(exception));
                const results = loadingModules[url];

                delete loadingModules[url];
                results.forEach(({ cerr }) => cerr(exception.value || exception.message || exception));
              },
              {
                prev: env,
                values: {
                  [ImportModuleName]: importModuleLocalized(url)
                }
              },
              {
                script,
                schedule: getTrampolineScheduler()
              }
            ),
          cerr
        ),
        cerr,
        env
      );
    }
  }

  return importModule;
}

export default {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ImportDeclaration,
  Identifier
};
