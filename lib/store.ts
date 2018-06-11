import { evalToPromise, MetaesContext } from "./metaes";
import { Evaluation, Interceptor } from "./types";
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

type RootValue = "_context";

type ExecutionNode = ASTNode & {
  evaluation: Evaluation | RootValue | string;
  children: ExecutionNode[];
  namedChildren: { [key: string]: ExecutionNode | ExecutionNode[] };
};

type EvaluationListener = (evaluation: Evaluation, flameGraph: FlameGraph) => void;
type FlameGraphs = { [key: string]: FlameGraph };

export class MetaesStore<T> {
  private _context: MetaesContext;
  private _listeners: EvaluationListener[] = [];
  private _proxies: MetaesProxy[] = [];
  private _flameGraphs: FlameGraphs = {};

  constructor(private _store: T, rootValueHandler?: MetaesProxyHandler) {
    const flameInterceptor = createFlameInterceptor(this._flameGraphs);
    const config = {
      interceptor: (...args) => {
        flameInterceptor.apply(null, args);
        this.interceptor.apply(this, args);
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
    function pathIncludes(type, path: ExecutionNode[]) {
      for (let i = path.length - 1; i >= 0; i--) {
        const element = path[i];
        if (typeof element.evaluation === "object" && element.evaluation.e.type === type) {
          console.log("has");
        }
      }
    }
    const tree = this._flameGraphs[scriptId];
    for (let i = 0; i < this._proxies.length; i++) {
      const proxy = this._proxies[i];
      if (proxy.target === value) {
        console.log(tree);
        pathIncludes("AssignmentExpression", tree.executionStack);
      }
    }
    this._listeners.forEach(interceptor => interceptor({ tag, e, value, env, timestamp, scriptId }, tree));
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
}

export function createFlameInterceptor(flameGraphs: FlameGraphs) {
  return (tag, e, value, env, timestamp, scriptId) => {
    let flameGraph = flameGraphs[scriptId];
    if (!flameGraph) {
      flameGraph = flameGraphs[scriptId] = {
        executionStack: [],
        root: {
          children: [],
          namedChildren: {},
          evaluation: "_context"
        }
      };
    }
    if (tag.phase === "enter") {
      const node: ExecutionNode = {
        evaluation: tag.propertyKey ? tag.propertyKey : { e, value, env, tag, timestamp, scriptId },
        namedChildren: {},
        children: []
      };
      flameGraph.executionStack.push(node);
      if (flameGraph.executionStack.length > 1) {
        const parent = flameGraph.executionStack[flameGraph.executionStack.length - 2];
        parent.children.push(node);
        if (typeof parent.evaluation === "string" && flameGraph.executionStack.length > 2) {
          const grandParent = flameGraph.executionStack[flameGraph.executionStack.length - 3];
          grandParent.namedChildren[parent.evaluation] = node;
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
