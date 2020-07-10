import { readFileSync } from "fs";
import * as path from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { getEnvironmentBy, GetValue } from "./environment";
import { evaluate } from "./evaluate";
import { LocatedError, presentException } from "./exceptions";
import { ExportEnvironmentSymbol, ImportBinding } from "./interpreter/modules";
import { ExceptionName } from "./interpreter/statements";
import { ModuleECMAScriptInterpreters } from "./interpreters";
import { createScript, metaesEvalModule } from "./metaes";
import * as NodeTypes from "./nodeTypes";
import { Environment, Evaluate, EvaluationConfig, MetaesException } from "./types";

function createTSModulesImporter(globalEnv: Environment = { values: {} }) {
  const loadedModules = {};
  const loadingModules = {};

  const localizedImportTSModule = (base) => (url) => importTSModule(path.join(path.parse(base).dir, url + ".ts"));

  async function importTSModule(url) {
    if (loadedModules[url]) {
      return Promise.resolve(loadedModules[url]);
    }

    if (loadingModules[url]) {
      return loadingModules[url];
    }

    return (loadingModules[url] = new Promise((resolve, reject) => {
      const source = transpileModule(readFileSync(url).toString(), {
        compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.ESNext }
      }).outputText;
      const script = createScript(source, undefined, "module");
      script.url = `transpiled://${url}`;

      metaesEvalModule(
        script,
        function (mod) {
          delete loadingModules[url];
          resolve((loadedModules[url] = mod));
        },
        (exception) => {
          console.log(presentException(exception));
          reject(exception.value || exception.message || exception);
        },
        {
          prev: globalEnv,
          values: {
            "[[GetBindingValue]]": async function (value: ImportBinding, c, cerr, env, config) {
              GetValue(
                { name: "[[ImportModule]]" },
                async (importTSModule) => {
                  const mod = await importTSModule(value.modulePath);
                  c(mod[value.name]);
                },
                cerr,
                env
              );
            },
            "[[ExportBinding]]": function ({ name, value, e }, c, cerr, env, config) {
              const exportEnv = getEnvironmentBy(env, (env) => env[ExportEnvironmentSymbol]);
              if (!exportEnv) {
                return cerr(
                  LocatedError(
                    `Couldn't export declaration, no environment with '${ExportEnvironmentSymbol}' property found.`,
                    e.declaration
                  )
                );
              }
              evaluate({ type: "SetValue", name, value, isDeclaration: true }, c, cerr, exportEnv, config);
            },
            "[[ImportModule]]": localizedImportTSModule(url)
          }
        },
        {
          script,
          interpreters: {
            prev: ModuleECMAScriptInterpreters,
            values: {
              CatchClause(e: NodeTypes.CatchClause, c, cerr, env, config: EvaluationConfig) {
                evaluate(
                  { type: "GetValue", name: ExceptionName },
                  (error: MetaesException) =>
                    evaluate(
                      e.body,
                      c,
                      cerr,
                      {
                        values: {
                          [e.param.name]: error
                        },
                        prev: env
                      },
                      config
                    ),
                  cerr,
                  env,
                  config
                );
              }
            }
          }
        }
      );
    }));
  }

  return importTSModule;
}

export const getMetaMetaESEval = async (globalEnv: Environment = { values: {} }) =>
  (await createTSModulesImporter(globalEnv)("lib/metaes.ts")).metaesEval as Evaluate;
