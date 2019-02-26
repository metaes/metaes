import * as bodyParser from "body-parser";
import * as express from "express";
import * as helmet from "helmet";
import * as cors from "cors";
import * as http from "http";
import * as WebSocket from "ws";
import { Environment } from "./environment";
import { log } from "./logging";
import { Context, evalAsPromise, MetaesContext } from "./metaes";
import { assertMessage, environmentFromMessage, environmentToMessage, mergeValues, MetaesMessage } from "./remote";
import { Continuation, ErrorContinuation, Source } from "./types";

const testContext = new MetaesContext(
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
  }
);

export const runWSServer = (port: number | undefined = undefined, context = testContext) =>
  new Promise((resolve, _reject) => {
    const server = http.createServer();
    const app = express();

    app.use(bodyParser.json());
    app.use(bodyParser.text());
    app.use(helmet());
    app.use(cors());

    // HTTP
    app.post("/", (req, res) => {
      const useJSON = req.headers["content-type"].indexOf("application/json") >= 0;
      try {
        if (useJSON) {
          const { input, env } = assertMessage(req.body, false) as MetaesMessage;
          log("[Server: got message]", { input, env });
          context.evaluate(
            input,
            value => res.send(JSON.stringify(value)),
            error => res.status(400).send(JSON.stringify(error)),
            env
          );
        } else {
          context.evaluate(
            req.body,
            value => res.send(JSON.stringify(value)),
            error => res.status(400).send(JSON.stringify(error))
          );
        }
      } catch (e) {
        const error = { message: Array.isArray(e) ? e.map(e => e.message) : e.message };
        res.status(400).send(JSON.stringify(error));
      }
    });

    // WS
    const webSocketServer = new WebSocket.Server({ server });

    webSocketServer.on("connection", connection => {
      const clientContext: Context = {
        evaluate: (input: Source, _c?: Continuation, _cerr?: ErrorContinuation, environment?: Environment) => {
          log("[Server: in evaluate/environment", environment);
          const message = {
            input: typeof input === "function" ? input.toString() : input,
            env: environmentToMessage(clientContext, mergeValues({}, environment))
          };
          log("[Server sending message]", JSON.stringify(message));
          connection.send(JSON.stringify(assertMessage(message)));
        }
      };

      connection.on("message", async message => {
        let environment;
        try {
          const { input, env } = assertMessage(JSON.parse(message)) as MetaesMessage;
          environment = env ? environmentFromMessage(clientContext, env) : { values: {} };
          log("[Server: got raw message]:", message);

          log("[Server: client environmentFromJSON]", environment);

          const result = await evalAsPromise(context, input, environment);
          log("[Server: result]", result);

          clientContext.evaluate(
            `c(result)`,
            environment.values.c,
            environment.values.cerr,
            mergeValues({ result }, environment)
          );
        } catch (e) {
          log("[Server: caught error]", e.message);
          log("[Server: client environment]", environment);
          log("[Server: client environmentToJSON]", environmentToMessage(clientContext, environment));
          clientContext.evaluate(
            `cerr(error)`,
            null,
            null,
            mergeValues({ error: { message: (e.originalError || e).message } }, environment)
          );
        }
      });

      connection.on("error", e => console.log(e));
      connection.on("close", () => log("[Server: closed ws connection with browser.]"));
    });

    server.on("request", app);
    server.on("error", e => log("[Server: caught error]", e));

    const callback = () => {
      log("[Server: Listening on " + JSON.stringify(server.address()) + "]");
      resolve(server);
    };
    port ? server.listen(port, callback) : server.listen(callback);
  });
