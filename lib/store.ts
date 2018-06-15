import { evalToPromise, MetaesContext } from "./metaes";
import { Evaluation, Source } from "./types";

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
  payload: Evaluation | string; // string is used only for script root, use different idea?
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
      interceptor: (evaluation: Evaluation) => {
        if (evaluation.tag.phase === "enter") {
          flameBuilderEnterPhase(evaluation);
        }
        try {
          this.interceptor(evaluation);
        } catch (e) {
          // TODO: use logger
          console.log(e);
        }
        if (evaluation.tag.phase === "exit") {
          flameBuilderExitPhase(evaluation);
        }
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

  interceptor(evaluation) {
    const { value, scriptId } = evaluation;
    const tree = this._flameGraphs[scriptId];
    for (let i = 0; i < this._proxies.length; i++) {
      const proxy = this._proxies[i];
      if (proxy.target === value) {
        // console.log(tree);
      }
    }

    this._listeners.forEach(listener => listener(evaluation, tree));
  }

  /**
   * Evaluates source in context of store.
   * @param source If not a function, the store is bound to `store` environment variable.
   * @param args
   */
  async evaluate(source: Source | ((store: T, ...rest) => void), ...args: any[]) {
    return typeof source === "function"
      ? (await evalToPromise(this._context, source)).apply(null, [this._store].concat(args))
      : await evalToPromise(this._context, source, {
          values: { store: this._store }
        });
  }

  c(e) {
    console.log("ok:", e);
  }

  cerr(exception) {
    console.log("exception:", exception);
  }

  private _createFlameGraphBuilder(phase: string) {
    return (evaluation: Evaluation) => {
      const { tag, scriptId } = evaluation;
      const flameGraph =
        this._flameGraphs[scriptId] ||
        (this._flameGraphs[scriptId] = {
          executionStack: [],
          root: {
            children: [],
            namedChildren: {},
            payload: "script" + scriptId
          }
        });
      const stack = flameGraph.executionStack;

      if (phase === "enter" && tag.phase === phase) {
        // enter
        const node: ExecutionNode = {
          payload: evaluation.tag && evaluation.tag.propertyKey ? evaluation.tag.propertyKey : evaluation,
          namedChildren: {},
          children: []
        };

        console.log(
          stack.map(s => {
            const pl = typeof s.payload === "string" ? s.payload : s.payload.e.type;
            return pl + ",";
          })
        );
        if (stack.length > 1) {
          const parent = stackAt(stack, 0);
          parent.children.push(node);
          if (typeof parent.payload === "string") {
            const grandParent = stackAt(stack, 1);
            const key = parent.payload;
            const namedChildren = grandParent.namedChildren;
            const values = namedChildren[key];
            console.log(node.payload.e || node.payload, "add at", key);
            if (values) {
              if (Array.isArray(values)) {
                values.push(node);
              } else {
                namedChildren[key] = [values, node];
              }
            } else {
              namedChildren[key] = node;
            }
          }
        } else {
          flameGraph.root.children.push(node);
        }
        stack.push(node);
      }
      if (phase === "exit" && tag.phase === phase) {
        // exit
        stack.pop();
      }
    };
  }
}

function stackAt(stack: ExecutionNode[], position: number) {
  const length = stack.length;
  return stack[length - 1 - position];
}
