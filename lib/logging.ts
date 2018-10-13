const DEBUG = true;
export function log(...messages) {
  if (DEBUG) {
    console.log(...messages);
  }
}
