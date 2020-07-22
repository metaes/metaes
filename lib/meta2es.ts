import { readFileSync } from "fs";
import * as path from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { evaluate } from "./evaluate";
import { presentException } from "./exceptions";
import { ImportModule } from "./interpreter/modules";
import { ExceptionName } from "./interpreter/statements";
import { ModuleECMAScriptInterpreters } from "./interpreters";
import { createScript, metaesEvalModule } from "./metaes";
import * as NodeTypes from "./nodeTypes";
import { Environment, EvaluationConfig, MetaesException } from "./types";

const interpreters = {
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
};

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

  const localizedImportTSModule = (base) => (url, c, cerr) =>
    importTSModule(path.join(path.parse(base).dir, url + ".ts"), c, cerr);

  function importTSModule(url, c, cerr) {
    if (loadedModules[url]) {
      c(loadedModules[url]);
    } else if (loadingModules[url]) {
      loadingModules[url].push({ c, cerr });
    } else {
      console.log("wait for", url);
      loadingModules[url] = [{ c, cerr }];
      const script = createScriptFromTS(url);

      metaesEvalModule(
        script,
        function (mod) {
          const results = loadingModules[url];
          loadedModules[url] = mod;
          delete loadingModules[url];
          console.log("resolved", url);
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
            [ImportModule]: localizedImportTSModule(url)
          }
        },
        {
          script,
          interpreters
        }
      );
    }
  }

  return importTSModule;
}

export const getMeta2ESEval = async (globalEnv: Environment = { values: {} }) =>
  getMeta2ES(globalEnv).then((mod) => mod.metaesEval);

export const getMeta2ES = (globalEnv: Environment = { values: {} }) =>
  new Promise((resolve, reject) => createTSModulesImporter(globalEnv)("lib/metaes.ts", resolve, reject));
