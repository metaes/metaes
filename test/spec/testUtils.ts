import { createScript } from "../../lib/metaes";
import { Environment } from "../../lib/types";

export const evaluateHelper = (evalFn, input: string, name = "anonymous", env: Environment = { values: {} }) =>
  new Promise((resolve, reject) => {
    const script = createScript(input);
    script.url = name;
    evalFn(script, resolve, reject, env);
  });
