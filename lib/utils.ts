import {LocatedError, NotImplementedYet} from "./types";
import {ReturnStatementValue, ThrowStatementValue} from "./applyEval";

export function lastArrayItem<T>(array?: T[]): T | null {
  if (array) {
    return array[array.length - 1];
  }
  return null;
}

export function errorShouldBeForwarded(e: Error) {
  return (
    e instanceof ReturnStatementValue ||
    e instanceof ThrowStatementValue ||
    e instanceof NotImplementedYet ||
    e instanceof LocatedError);
}

export function flatten<T>(array: (T | T[])[]) {
  let out: T[] = [];
  for (let item of array) {
    if (Array.isArray(item)) {
      out.push(...item);
    } else {
      out.push(item);
    }
  }
  return out;
}

export function getUUID() {
  if (typeof crypto === "object" && typeof Uint8Array === 'function') {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var v: number;
      var r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } else {
    var s4 = function () {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    };
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
  }
}