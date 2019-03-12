import { evaluate } from "../evaluate";
import { Environment } from "../environment";
import { NotImplementedException } from "../exceptions";
import * as NodeTypes from "../nodeTypes";

export function Identifier(e: NodeTypes.Identifier, c, cerr, env: Environment, config) {
  evaluate(
    { type: "GetValue", name: e.name },
    c,
    exception => {
      exception.location = e;
      cerr(exception);
    },
    env,
    config
  );
}

export function Literal(e: NodeTypes.Literal, c) {
  c(e.value);
}

export function Apply({ fn, thisObj, args }: NodeTypes.Apply, c, cerr) {
  try {
    if (typeof fn === "function") {
      c(fn.apply(thisObj, args));
    } else if (thisObj) {
      c(thisObj[fn].apply(thisObj, args));
    } else {
      throw new TypeError(`Couldn't call method '${fn}' on undefined or null.`);
    }
  } catch (e) {
    cerr(e);
  }
}

export function GetProperty({ object, property }: NodeTypes.GetProperty, c) {
  c(object[property]);
}

// TODO: when not using `=` should also incorporate GetValue
export function SetProperty({ object, property, value, operator }: NodeTypes.SetProperty, c, cerr) {
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

export default {
  Identifier,
  Literal,
  Apply,
  GetProperty,
  SetProperty
};
