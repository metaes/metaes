import { createEnvironment } from "./environment";
import { readFileSync } from "fs";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { createModulesImporter, CreateScriptName, GetModuleSourceName } from "./interpreter/modules";
import type * as metaes from "./metaes";
import { cpsify, uncpsp } from "./metaes";
import { createScript } from "./script";
import { Environment } from "./types";
import { createHash } from "crypto";

const compileCache: { [key: string]: string } = {};

/**
 * Compile TypeScript sript to MetaES script object.
 */
function compileTsToScript(url: string) {
  const source = readFileSync(url).toString();
  const checksum = createHash("sha256").update(source).digest("hex");

  const compiled =
    compileCache[checksum] ||
    (compileCache[checksum] = transpileModule(source, {
      compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.ESNext }
    }).outputText);

  const script = createScript(compiled, undefined, "module");
  script.url = `transpiled://${url}`;
  return script;
}

export const getModule2 = <T>(path: string, globalEnv?: Environment) =>
  uncpsp(
    createModulesImporter(
      createEnvironment(
        { [CreateScriptName]: cpsify(compileTsToScript), [GetModuleSourceName]: cpsify(require) },
        globalEnv
      )
    )
  )(path) as Promise<T>;

export const getMeta2ES = (globalEnv?: Environment) => getModule2<typeof metaes>("./lib/metaes.ts", globalEnv);

export const getMeta2ESEval = (globalEnv?: Environment) => getMeta2ES(globalEnv).then((mod) => mod.metaesEval);
