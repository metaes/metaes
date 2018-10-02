import { Environment, getValue } from "../environment";
import { Identifier, Literal } from "../nodeTypes";
import { NotImplementedException } from "../exceptions";

export function Identifier(e: Identifier, c, cerr, env: Environment) {
  getValue(env, e.name, c, exception => {
    (exception.location = e), cerr(exception);
  });
}

export function Literal(e: Literal, c) {
  c(e.value);
}

export function GetProperty({ object, property }, c) {
  c(object[property]);
}

export function SetProperty({ object, property, value, operator }, c, cerr) {
  switch (operator) {
    case "=":
      c((object[property] = value));
      break;
    case "+=":
      c((object[property] += value));
      break;
    case "-=":
      c((object[property] -= value));
      break;
    case "*=":
      c((object[property] *= value));
      break;
    case "/=":
      c((object[property] /= value));
      break;
    case "%=":
      c((object[property] %= value));
      break;
    case "<<=":
      c((object[property] <<= value));
      break;
    case ">>=":
      c((object[property] >>= value));
      break;
    case ">>>=":
      c((object[property] >>>= value));
      break;
    case "&=":
      c((object[property] &= value));
      break;
    case "|=":
      c((object[property] |= value));
      break;
    case "^=":
      c((object[property] ^= value));
      break;
    default:
      cerr(NotImplementedException(`Operator '${operator}' is not supported.`));
  }
}
