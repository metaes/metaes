import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join, parse } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { createEnvironment } from "./environment";
import { createModulesImporter } from "./interpreter/modules";
import type * as metaes from "./metaes";
import { cpsify, uncpsp } from "./metaes";
import { intristic } from "./names";
import { createScript } from "./script";
import { Environment } from "./types";

const compileCache: { [key: string]: string } = {};

/**
 * Compile TypeScript sc
 ript to MetaES script object.
 */
function compileTsToScript(importPath: string, base: string) {
  // Assumption: if this condition is true, then the module should be loaded using MetaES and TS compiler.
  // Otherwise import using node's `require`.
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    const resolvedPath = "./" + join(parse(base).dir, importPath + ".ts");
    const source = readFileSync(resolvedPath).toString();
    const checksum = createHash("sha256").update(source).digest("hex");
    const compiled =
      compileCache[checksum] ||
      (compileCache[checksum] = transpileModule(source, {
        compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.ESNext }
      }).outputText);
    const script = createScript(compiled, undefined, "module");
    script.url = `transpiled://${resolvedPath}`;
    return { resolvedPath, script };
  } else {
    const mod = require(importPath);
    return { module: { ...mod, default: mod } };
  }
}

export function getModule2(basePath: string, globalEnv?: Environment) {
  const values = {
    [intristic.URLToScript]: cpsify(([url, base]) => compileTsToScript(url, base))
  };

  return createModulesImporter(createEnvironment(values, globalEnv))(basePath);
}

export const getMeta2ES = (globalEnv?: Environment) =>
  uncpsp(getModule2("", globalEnv))("./lib/metaes") as Promise<typeof metaes>;

export const getMeta2ESEval = async (globalEnv?: Environment) => (await getMeta2ES(globalEnv)).metaesEval;
