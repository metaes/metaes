import { evalToPromise, MetaesContext } from "./metaes";
import { Evaluation } from "./types";
import { ASTNode } from "./nodes/nodes";

type MetaesProxyHandler = {
  apply?: (target: object, methodName: string, args: any[]) => void;
  get?: (target: object, key: string, value: any) => void;
  set?: (target: object, key: string, args: any) => void;
};

type MetaesProxy = {
  target: any;
  handler: MetaesProxyHandler;
};

export type FlameGraph = { root: ExecutionNode; executionStack: ExecutionNode[] };

export type ExecutionNode = {
  e: ASTNode;
  value: any;
  children: ExecutionNode[];
  namedChildren: { [key: string]: ExecutionNode | ExecutionNode[] };
};

type EvaluationListener = (node: Evaluation, flameGraph: FlameGraph) => void;
type FlameGraphs = { [key: string]: FlameGraph };

export class MetaesStore<T> {
  private _context: MetaesContext;
  private _listeners: EvaluationListener[] = [];
  private _proxies: MetaesProxy[] = [];
  private _flameGraphs: FlameGraphs = {};

  constructor(private _store: T, rootValueHandler?: MetaesProxyHandler) {
    const flameBuilderEnterPhase = this._createFlameGraphBuilder("enter");
    const flameBuilderExitPhase = this._createFlameGraphBuilder("exit");
    const config = {
      interceptor: (...args) => {
        flameBuilderEnterPhase.apply(null, args);
        try {
          this.interceptor.apply(this, args);
        } catch (e) {
          // TODO: use logger
          console.log(e);
        }
        flameBuilderExitPhase.apply(null, args);
      }
    };
    this._context = new MetaesContext(
      this.c.bind(this),
      this.cerr.bind(this),
      { values: { store: this._store, console } },
      config
    );
    if (rootValueHandler) {
      this._proxies.push({ handler: rootValueHandler, target: _store });
    }
  }

  getStore() {
    return this._store;
  }

  addListener(listener: EvaluationListener) {
    this._listeners.push(listener);
  }

  interceptor(tag, e, value, env, timestamp, scriptId) {
    const tree = this._flameGraphs[scriptId];
    for (let i = 0; i < this._proxies.length; i++) {
      const proxy = this._proxies[i];
      if (proxy.target === value) {
        // console.log(tree);
      }
    }
    const evaluation = { tag, e, value, env, timestamp, scriptId };
    this._listeners.forEach(listener => listener(evaluation, tree));
  }

  async evaluate(source: ((store: T, ...rest) => void), ...args: any[]) {
    return (await evalToPromise(this._context, source)).apply(null, [this._store].concat(args));
  }

  c(e) {
    console.log("ok:", e);
  }

  cerr(exception) {
    console.log("exception:", exception);
  }

  private _createFlameGraphBuilder(phase: string) {
    return (tag, e, value, env, timestamp, scriptId) => {
      let flameGraph = this._flameGraphs[scriptId];
      if (!flameGraph) {
        flameGraph = this._flameGraphs[scriptId] = {
          executionStack: [],
          root: {
            children: [],
            namedChildren: {},
            value: "script" + scriptId
          }
        };
      }
      if (tag.phase === phase) {
        const node: ExecutionNode = {
          value: tag.propertyKey ? tag.propertyKey : { e, value, env, tag, timestamp, scriptId },
          namedChildren: {},
          children: []
        };
        flameGraph.executionStack.push(node);
        if (flameGraph.executionStack.length > 1) {
          const parent = flameGraph.executionStack[flameGraph.executionStack.length - 2];
          parent.children.push(node);
          if (typeof parent.value === "string" && flameGraph.executionStack.length > 2) {
            const grandParent = flameGraph.executionStack[flameGraph.executionStack.length - 3];
            grandParent.namedChildren[parent.value] = node;
          }
        } else {
          flameGraph.root.children.push(node);
        }
      } else {
        // exit
        flameGraph.executionStack.pop();
      }
    };
  }
}
