import { readFileSync } from "fs";
import * as path from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { getEnvironmentBy, GetValue } from "./environment";
import { evaluate } from "./evaluate";
import { LocatedError, presentException } from "./exceptions";
import { ExportEnvironmentSymbol, ImportBinding } from "./interpreter/modules";
import { createScript, metaesEvalModule } from "./metaes";
import { Evaluate } from "./types";

const loadedModules = {};
const loadingModules = {};

const localizedImportTSModule = (base) => (url) => importTSModule(path.join(path.parse(base).dir, url + ".ts"));

export async function importTSModule(url) {
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
    // console.log(source);
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
        values: {
          Object,
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
      { script }
    );
  }));
}

export const getMetaMetaESEval = async () => (await importTSModule("lib/metaes.ts")).metaesEval as Evaluate;