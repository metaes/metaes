import { MetaesContext, evalToPromise, ScriptingContext } from "./metaes";
import { Environment, mergeValues } from "./environment";
import { environmentFromJSON, environmentToJSON, Message, assertMessage } from "./remote";
import { OnSuccess, Source, OnError } from "./types";
import * as WebSocket from "ws";
import * as express from "express";
import * as http from "http";
import * as helmet from "helmet";
import * as bodyParser from "body-parser";

const config = {
  port: 8082
};

const localContext = new MetaesContext(
  value => {
    console.log("[value]");
    console.log(value);
  },
  e => console.log(e),
  {
    values: {
      fs: require("fs"),
      child_process: require("child_process"),
      console
    }
  },
  {
    onError: e => {
      console.log("[error callback]");
      console.log(e);
    }
  }
);

export const runWSServer = (port: number = config.port) =>
  new Promise((resolve, _reject) => {
    const server = http.createServer();
    const app = express();
    app.use(bodyParser.json());
    app.use(helmet());

    const webSocketServer = new WebSocket.Server({ server });

    webSocketServer.on("connection", connection => {
      const remoteContext: ScriptingContext = {
        // TODO: should return a promise too
        evaluate: (input: Source, c?: OnSuccess, cerr?: OnError, environment?: Environment) => {
          const message = {
            source: input,
            env: environmentToJSON(localContext, mergeValues({}, environment))
          };
          // console.log("[server sending message]");
          // console.log(JSON.stringify(message));
          connection.send(JSON.stringify(assertMessage(message)));
        }
      };

      connection.on("message", async message => {
        try {
          const { source, env } = assertMessage(JSON.parse(message)) as Message;
          const environment = env ? environmentFromJSON(localContext, env) : { values: {} };
          console.log("[server got message]:");
          console.log(message);
          console.log("[environment]");
          console.log(environment);

          let result = await evalToPromise(localContext, source, environment);
          console.log("[result]");
          console.log(result);
          remoteContext.evaluate(
            `c(result)`,
            environment.values.c,
            environment.values.cerr,
            mergeValues({ result }, environment)
          );
        } catch (e) {
          remoteContext.evaluate(`cerr(error)`, null, null, {
            values: { error: { message: (e.originalError || e).message } }
          });
        }
      });

      connection.on("error", e => console.log(e));
      connection.on("close", () => console.log("closed ws connection with browser."));
    });

    server.on("request", app);
    server.listen(port, () => {
      console.log("Listening on " + server.address().port);
      resolve(server);
    });
  });
