import { Environment, getValue } from "../environment";
import { Identifier, Literal } from "../nodeTypes";

export function Identifier(e: Identifier, c, cerr, env: Environment) {
  getValue(env, e.name, c, exception => {
    (exception.location = e), cerr(exception);
  });
}

export function Literal(e: Literal, c) {
  c(e.value);
}
