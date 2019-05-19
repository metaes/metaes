import { GetValue, SetValue } from "./environment";
import Base from "./interpreter/base";
import Expressions from "./interpreter/expressions";
import Statements from "./interpreter/statements";

export const ECMAScriptInterpreters = {
  values: { SetValue, GetValue, ...Base, ...Expressions, ...Statements }
};
