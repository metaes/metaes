import { evaluate, getLocRangeOf } from "../evaluate";
import { NotImplementedException, toException } from "../exceptions";
import { evaluateMetaFunction, getMetaFunction, isMetaFunction } from "../metafunction";
import * as NodeTypes from "../nodeTypes";
import { Interpreter } from "../types";

export const Identifier: Interpreter<NodeTypes.Identifier> = (e, c, cerr, env, config) =>
  evaluate({ type: "GetValue", name: e.name, ...getLocRangeOf(e) }, c, cerr, env, config);

export const Literal: Interpreter<NodeTypes.Literal> = (e, c) => c(e.value);

const { call, apply } = Function.prototype;

export const Apply: Interpreter<NodeTypes.Apply> = ({ fn, thisValue, args }, c, cerr, _env, config) => {
  try {
    if (isMetaFunction(fn)) {
      evaluateMetaFunction(getMetaFunction(fn), c, cerr, thisValue, args, config);
    }
    // TODO: add tests
    else if (isMetaFunction(thisValue) && (fn === call || fn === apply)) {
      evaluateMetaFunction(getMetaFunction(thisValue), c, cerr, undefined, args, config);
    } else {
      c(fn.apply(thisValue, args));
    }
  } catch (e) {
    cerr(e);
  }
};

export const GetProperty: Interpreter<NodeTypes.GetProperty> = ({ object, property }, c, cerr, _env, _config) => {
  if (object) {
    try {
      c(object[property]);
    } catch (e) {
      cerr(toException(e));
    }
  } else {
    cerr(
      toException(new TypeError(`Cannot read property '${property}' of ${object === null ? "null" : typeof object}`))
    );
  }
};

// TODO: when not using `=` should also incorporate GetValue
export const SetProperty: Interpreter<NodeTypes.SetProperty> = ({ object, property, value, operator }, c, cerr) => {
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
};

export default {
  Identifier,
  Literal,
  Apply,
  GetProperty,
  SetProperty
};
