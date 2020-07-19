import { readFileSync } from "fs";
import * as path from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { evaluate } from "./evaluate";
import { presentException } from "./exceptions";
import { ExceptionName } from "./interpreter/statements";
import { ModuleECMAScriptInterpreters } from "./interpreters";
import { createScript, metaesEvalModule } from "./metaes";
import * as NodeTypes from "./nodeTypes";
import { Environment, Evaluate, EvaluationConfig, MetaesException } from "./types";
import { ImportModule } from "./interpreter/modules";

export function createTSModulesImporter(globalEnv: Environment = { values: {} }) {
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
            [ImportModule]: localizedImportTSModule(url)
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

export const getMeta2ESEval = async (globalEnv: Environment = { values: {} }) =>
  (await createTSModulesImporter(globalEnv)("lib/metaes.ts")).metaesEval as Evaluate;

export const getMeta2ES = async (globalEnv: Environment = { values: {} }) =>
  await createTSModulesImporter(globalEnv)("lib/metaes.ts");
