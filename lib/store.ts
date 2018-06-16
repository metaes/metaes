import {evalToPromise, MetaesContext} from "./metaes";
import {Evaluation, Source} from "./types";
import {ASTNode} from "./nodes/nodes";

type MetaesProxyHandler = {
  apply?: (target: object, methodName: string, args: any[]) => void;
  get?: (target: object, key: string, value: any) => void;
  set?: (target: object, key: string, args: any) => void;
};

type MetaesProxy = {
  target: any;
  handler: MetaesProxyHandler;
};

export type FlameGraph = { root: EvaluationNode[]; executionStack: EvaluationNode[]; values: Map<ASTNode, any> };

export type EvaluationNode = {
  evaluation: Evaluation;
  children: EvaluationNode[];
};

type EvaluationListener = (node: Evaluation, flameGraph: FlameGraph) => void;
type FlameGraphs = { [key: string]: FlameGraph };

export class MetaesStore<T> {
  private _context: MetaesContext;
  private _listeners: EvaluationListener[] = [];
  private _proxies: MetaesProxy[] = [];
  private _flameGraphs: FlameGraphs = {};

  constructor(private _store: T, rootValueHandler?: MetaesProxyHandler) {

    const config = {
      interceptor: (evaluation: Evaluation) => {
        this._flameGraphBuilder("before", evaluation);
        try {
          this.interceptor(evaluation);
        } catch (e) {
          // TODO: use logger
          console.log(e);
        }
        this._flameGraphBuilder("after", evaluation);
      }
    };
    this._context = new MetaesContext(
      this.c.bind(this),
      this.cerr.bind(this),
      {values: {store: this._store, console}},
      config
    );
    if (rootValueHandler) {
      this._proxies.push({handler: rootValueHandler, target: _store});
    }
  }

  getStore() {
    return this._store;
  }

  addListener(listener: EvaluationListener) {
    this._listeners.push(listener);
  }

  interceptor(evaluation) {
    const {scriptId} = evaluation;
    const flameGraph = this._flameGraphs[scriptId];

    if (evaluation.tag.phase === "exit" && evaluation.e.type === "AssignmentExpression") {
      const getValue = e => flameGraph.values.get(e);
      const assignment = evaluation.e as any;
      const left = getValue(assignment.left.object);
      if (left) {
        for (let i = 0; i < this._proxies.length; i++) {
          const proxy = this._proxies[i];
          if (proxy.target === left && proxy.handler.set) {
            proxy.handler.set(left, getValue(assignment.left.property), getValue(assignment.right))
          }
        }
      }
    }


    this._listeners.forEach(listener => listener(evaluation, flameGraph));
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
        values: {store: this._store}
      });
  }

  c(e) {
    console.log("ok:", e);
  }

  cerr(exception) {
    console.log("exception:", exception);
  }

  private _flameGraphBuilder(phase: "before" | "after", evaluation: Evaluation) {
    const {tag, scriptId} = evaluation;
    const flameGraph =
      this._flameGraphs[scriptId] ||
      (this._flameGraphs[scriptId] = {
        executionStack: [],
        values: new Map(),
        root: []
      });
    const stack = flameGraph.executionStack;

    if (phase === "before") {
      if (tag.phase === "enter") {
        const node: EvaluationNode = {
          evaluation,
          children: []
        };
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(node);
        }
        stack.push(node);
      } else {
        flameGraph.values.set(evaluation.e, evaluation.value);
      }
    }
    if (phase === "after" && tag.phase === "exit") {
      stack.pop();
    }
  }
}
