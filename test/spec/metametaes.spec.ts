import { readFileSync } from "fs";
import { describe, it } from "mocha";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { presentException as presentedException } from "../../lib/exceptions";
import { createScript, metaesEvalModule } from "../../lib/metaes";
import * as path from "path";

const loadedModules = {};

function localizedImportTSModule(base) {
  return (url) => importTSModule(path.join(path.parse(base).dir, url + ".ts"));
}

async function importTSModule(url) {
  console.log("import", url);

  if (loadedModules[url]) {
    console.log("use cache for", url);
    return Promise.resolve(loadedModules[url]);
  }

  return new Promise((resolve, reject) => {
    const source = transpileModule(readFileSync(url).toString(), {
      compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.ESNext }
    }).outputText;

    const script = createScript(source, undefined, "module");
    script.url = url;

    metaesEvalModule(
      script,
      (mod) => resolve((loadedModules[url] = mod)),
      (exception) => {
        console.log(presentedException(script, exception));
        reject(exception.value || exception.message || exception);
      },
      {
        values: {
          import: localizedImportTSModule(url)
        }
      }
    );
  });
}

describe.skip("Meta MetaES", function () {
  it("test", async function () {
    try {
      console.log("imported", await importTSModule("lib/metaes.ts"));
    } catch (error) {
      console.log(error);
    }
  });
});
