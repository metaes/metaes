import { Environment, getValue } from "../environment";
import { Identifier, Literal, GetProperty, SetProperty, Apply } from "../nodeTypes";
import { NotImplementedException } from "../exceptions";

export function Identifier(e: Identifier, c, cerr, env: Environment) {
  getValue(env, e.name, c, exception => {
    (exception.location = e), cerr(exception);
  });
}

export function Literal(e: Literal, c) {
  c(e.value);
}

export function Apply({ fn, thisObj, args }: Apply, c, cerr) {
  try {
    c(fn.apply(thisObj, args));
  } catch (e) {
    cerr(e);
  }
}

export function GetProperty({ object, property }: GetProperty, c) {
  c(object[property]);
}

export function SetProperty({ object, property, value, operator }: SetProperty, c, cerr) {
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
