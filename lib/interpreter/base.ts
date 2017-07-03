import {Environment, getValue} from "../environment";
import {EvaluationConfig} from "../types";
import {Identifier, Literal} from "../nodeTypes";

export function Identifier(e: Identifier, env: Environment, _config: EvaluationConfig, c, cerr) {
  getValue(env, e.name, c, cerr);
}

export function Literal(e: Literal, _env, _config, c) {
  c(e.value);
} 