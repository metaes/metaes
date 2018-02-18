import { MetaESContext, evaluatePromisified, ScriptingContext } from "./metaes";
import { Environment } from "./environment";
import { environmentFromJSON, environmentToJSON, Message, validateMessage } from "./remote";
import { EvaluationSuccess, EvaluationError, Source } from "./types";
import { valuesIntoEnvironment } from "./environment";
import * as WebSocket from "ws";
import * as express from "express";
import * as http from "http";
import * as helmet from "helmet";
import * as bodyParser from "body-parser";

const config = {
  port: 8082
};

export const runWSServer = (port: number = config.port) =>
  new Promise((resolve, _reject) => {
    const server = http.createServer();
    const app = express();
    app.use(bodyParser.json());
    app.use(helmet());

    const localContext = new MetaESContext(
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

    const webSocketServer = new WebSocket.Server({ server });

    webSocketServer.on("connection", connection => {
      const remoteContext: ScriptingContext = {
        // TODO: should return a promise too
        evaluate: (input: Source, c?: EvaluationSuccess, cerr?: EvaluationError, environment?: Environment) => {
          const message = {
            source: input,
            env: environmentToJSON(localContext, valuesIntoEnvironment({}, environment))
          };
          // console.log("[server sending message]");
          // console.log(JSON.stringify(message));
          connection.send(JSON.stringify(validateMessage(message)));
        }
      };

      connection.on("message", async message => {
        const { source, env } = validateMessage(JSON.parse(message)) as Message;
        const environment = env ? environmentFromJSON(localContext, env, remoteContext) : { values: {} };
        // console.log("[server got message]:");
        // console.log(message);
        // console.log("[environment]");
        // console.log(environment);
        try {
          let result = await evaluatePromisified(localContext, source, environment);
          // console.log("[early result]");
          // console.log(result);
          remoteContext.evaluate(`c(result)`, valuesIntoEnvironment({ result }, environment));
        } catch (e) {
          remoteContext.evaluate(
            `cerr(error)`,
            valuesIntoEnvironment(
              { error: { originalError: { message: (e.originalError || e).message } } },
              environment
            )
          );
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
