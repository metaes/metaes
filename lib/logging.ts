const DEBUG = false;
export function log(...messages) {
  if (DEBUG) {
    console.log(...messages);
  }
}
