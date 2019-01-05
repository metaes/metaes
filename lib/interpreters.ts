import { Environment, SetValue, GetValue } from "./environment";
import Base from "./interpreter/base";
import Expressions from "./interpreter/expressions";
import Statements from "./interpreter/statements";

export const ECMAScriptInterpreters: Environment = {
  values: Object.assign({ SetValue, GetValue }, Base, Expressions, Statements)
};
