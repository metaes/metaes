import { readFileSync } from "fs";
import * as path from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { getTrampolineScheduler } from "./evaluate";
import { presentException } from "./exceptions";
import { ImportModuleName } from "./interpreter/modules";
import { metaesEvalModule, uncpsp } from "./metaes";
import { createScript } from "./script";
import { Continuation, Environment, ErrorContinuation } from "./types";

function createScriptFromTS(url) {
  const source = transpileModule(readFileSync(url).toString(), {
    compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.ESNext }
  }).outputText;

  const script = createScript(source, undefined, "module");
  script.url = `transpiled://${url}`;
  return script;
}

function createTSModulesImporter(globalEnv: Environment = { values: {} }) {
  const loadedModules = {};
  const loadingModules = {};

  const localizedImportTSModule = (base: string) => (url: string, c: Continuation, cerr: ErrorContinuation) => {
    if (url.startsWith("./") || url.startsWith("../")) {
      importTSModule("./" + path.join(path.parse(base).dir, url + ".ts"), c, cerr);
    } else {
      if (loadedModules[url]) {
        c(loadedModules[url]);
      } else {
        try {
          const mod = require(url);
          c((loadedModules[url] = { ...mod, default: mod }));
        } catch (e) {
          cerr(e);
        }
      }
    }
  };

  function importTSModule(url: string, c: Continuation, cerr: ErrorContinuation) {
    if (loadedModules[url]) {
      c(loadedModules[url]);
    } else if (loadingModules[url]) {
      loadingModules[url].push({ c, cerr });
    } else {
      loadingModules[url] = [{ c, cerr }];
      try {
        const script = createScriptFromTS(url);

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
            prev: globalEnv,
            values: {
              [ImportModuleName]: localizedImportTSModule(url)
            }
          },
          {
            script,
            schedule: getTrampolineScheduler()
          }
        );
      } catch (error) {
        cerr(error);
      }
    }
  }

  return importTSModule;
}

export const getMeta2ESEval = async (globalEnv: Environment = { values: {} }) =>
  getMeta2ES(globalEnv).then((mod: any) => mod.metaesEval);

export const getModule2 = (path: string, globalEnv: Environment = { values: {} }) =>
  uncpsp(createTSModulesImporter(globalEnv))(path);

export const getMeta2ES = (globalEnv: Environment = { values: {} }) => getModule2("./lib/metaes.ts", globalEnv);
