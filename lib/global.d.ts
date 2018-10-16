declare interface Object {
  entries: Function;
}

declare namespace NodeJS {
  interface Global {
    fetch?: Function;
  }
}
