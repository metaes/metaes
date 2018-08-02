import { runWSServer } from "./server";

export const testServerPort = 8082;
let server, serverAlreadyAskedToStart;

export async function createTestServer(port: number = testServerPort) {
  if (serverAlreadyAskedToStart && !server) {
    // periodically check if server is assigned
    return new Promise(resolve => {
      let interval = setInterval(() => {
        if (server) {
          clearInterval(interval);
          resolve(server);
        }
      }, 10);
    });
  } else if (server) {
    return Promise.resolve(server);
  } else {
    serverAlreadyAskedToStart = true;
    return (server = await runWSServer(port));
  }
}
