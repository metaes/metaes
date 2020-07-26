import { readFileSync } from "fs";
import * as path from "path";
import { createScript, metaesEvalModule } from "./metaes";
import { getTrampolineScheduler, evaluate } from "./evaluate";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { presentException } from "./exceptions";
import { ImportModule } from "./interpreter/modules";
import { Continuation, Environment, ErrorContinuation, EvaluationConfig, MetaesException } from "./types";
import { ModuleECMAScriptInterpreters } from "./interpreters";
import { ExceptionName } from "./interpreter/statements";
import * as NodeTypes from "./nodeTypes";

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

  const localizedImportTSModule = (base: string) => (url: string, c: Continuation, cerr: ErrorContinuation) => {
    if (url.startsWith("./") || url.startsWith("../")) {
      importTSModule("./" + path.join(path.parse(base).dir, url + ".ts"), c, cerr);
    } else {
      if (loadedModules[url]) {
        c(loadedModules[url]);
      } else {
        try {
          c((loadedModules[url] = { default: require(url) }));
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
      // console.log("wait for", url);
      loadingModules[url] = [{ c, cerr }];
      try {
        const script = createScriptFromTS(url);

        metaesEvalModule(
          script,
          function (mod) {
            const results = loadingModules[url];
            loadedModules[url] = mod;
            delete loadingModules[url];
            // console.log("resolved", url);
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
            interpreters,
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

export const getMeta2ES = (globalEnv: Environment = { values: {} }) =>
  new Promise((resolve, reject) => createTSModulesImporter(globalEnv)("./lib/metaes.ts", resolve, reject));
