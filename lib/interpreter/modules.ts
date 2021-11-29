import { EvaluateMid } from "../types";
import { getEnvironmentBy, GetValue } from "../environment";
import { at, declare, evaluate, get, getTrampolineScheduler, superi, visitArray } from "../evaluate";
import { LocatedException, NotImplementedException } from "../exceptions";
import { bindArgs, metaesEvalModule } from "../metaes";
import * as NodeTypes from "../nodeTypes";
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  Interpreter,
  Interpreters,
  MetaesException,
  NodeLoc,
  Script
} from "../types";

// TODO: switch to "intristic" names inside object, like in vanillinjs
export const ImportEnvironment = "[[ImportEnvironment]]";
export const ExportEnvironment = "[[ExportEnvironment]]";
export const GetImportBindingValue = "[[GetImportBindingValue]]";
export const ImportModule = "[[ImportModule]]";
export const URLToScript = "[[URLToScript]]";
export const ExportBinding = "[[ExportBinding]]";

export const modulesEnv: Interpreters = {
  [GetImportBindingValue](value: ImportBinding, c, cerr, env, config) {
    evaluate(
      at(value, get(ImportModule)),
      bindArgs(value.modulePath, (mod) => c(mod[value.name]), cerr),
      cerr,
      env,
      config
    );
  },
  [ExportBinding]({ name, value, e }, c, cerr, env, config) {
    const exportEnv = getEnvironmentBy(env, (env) => env[ExportEnvironment]);
    if (exportEnv) {
      evaluate(declare(name, value), c, cerr, exportEnv, config);
    } else {
      cerr(
        LocatedException(
          `Couldn't export declaration, no environment with '${ExportEnvironment}' property found.`,
          e.declaration
        )
      );
    }
  }
};

export const Identifier: Interpreter<NodeTypes.Identifier> = (e, c, cerr, env, config) =>
  superi("Identifier")(
    e,
    (value) => {
      value instanceof ImportBinding
        ? evaluate(at(e, get(GetImportBindingValue)), bindArgs(value, c, cerr, env, config), cerr, env, config)
        : c(value);
    },
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
        get(ExportBinding),
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
        get(ExportBinding),
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

export function createModulesImporter(globalEnv: Environment) {
  const _ = (name: string) => (arg, c, cerr) => GetValue({ name }, bindArgs(arg, c, cerr), cerr, globalEnv);

  const loadedModules: { [key: string]: object } = {};
  const loadingModules: { [key: string]: [{ c: Continuation; cerr: ErrorContinuation }] } = {};

  const resolveModule = (url: string) => (mod: object) => {
    const results = loadingModules[url];
    loadedModules[url] = mod;
    delete loadingModules[url];
    results.forEach(({ c }) => c(mod));
  };

  const rejectModule = (url: string) => (exception: MetaesException) => {
    const results = loadingModules[url];
    delete loadingModules[url];
    results.forEach(({ cerr }) => cerr(exception));
  };

  const importer =
    (base: string): EvaluateMid<{ [key: string]: any }, string> =>
    (url, c, cerr) => {
      if (loadedModules[url]) {
        c(loadedModules[url]);
      } else if (loadingModules[url]) {
        loadingModules[url].push({ c, cerr });
      } else {
        loadingModules[url] = [{ c, cerr }];
        _(URLToScript)(
          [url, base],
          (result: { script: Script; resolvedPath: string } | { module: object }) => {
            if ("module" in result) {
              resolveModule(url)(result.module);
            } else {
              const { script, resolvedPath } = result;
              metaesEvalModule(
                script,
                resolveModule(url),
                rejectModule(url),
                { values: { [ImportModule]: importer(resolvedPath) }, prev: globalEnv },
                {
                  script,
                  schedule: getTrampolineScheduler()
                }
              );
            }
          },
          rejectModule(url)
        );
      }
    };
  return importer;
}

export default {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ImportDeclaration,
  Identifier
};
