import { parseFunction } from "./metaes";
import { parse, ParseCache } from "./parse";
import { Script, ScriptType, Source } from "./types";

let scriptIdsCounter = 0;

export const nextScriptId = () => "" + scriptIdsCounter++;

export function createScript(source: Script | Source, cache?: ParseCache, type: ScriptType = "script"): Script {
  if (isScript(source)) {
    return source;
  } else {
    if (typeof source === "object") {
      return { source, ast: source, scriptId: nextScriptId() };
    } else if (typeof source === "function") {
      return { source, ast: parseFunction(source, cache), scriptId: nextScriptId() };
    } else if (typeof source === "string") {
      const script: Script = { source, ast: parse(source, {}, cache, type === "module"), scriptId: nextScriptId() };
      if (type === "module") {
        script.type = type;
      }
      return script;
    } else {
      throw new Error(`Can't create script from ${source}.`);
    }
  }
}

export function toScript(input: Source | Script, cache?: ParseCache, type: ScriptType = "script") {
  return isScript(input) ? input : createScript(input, cache, type);
}

export function isScript(script: any): script is Script {
  return typeof script === "object" && "source" in script && "ast" in script && "scriptId" in script;
}
