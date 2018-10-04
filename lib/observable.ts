import { MetaesContext } from "./metaes";
import { ASTNode } from "./nodes/nodes";
import { createCache } from "./parse";
import { Evaluation } from "./types";
import { Apply } from "./nodeTypes";

type Traps = {
  apply?: (target: object, methodName: string, args: any[], expressionValue: any) => void;
  get?: (target: object, key: string, value: any) => void;
  set?: (target: object, key: string, args: any) => void;
  didSet?: (target: object, key: string, args: any) => void;
};

type ObserverHandler = {
  target: any;
  traps: Traps;
};

export type FlameGraph = {
  executionStack: EvaluationNode[];
  oneTimeInterceptors: InterceptorOnce[];
  values: Map<ASTNode, any>;
};

export type EvaluationNode = {
  evaluation: Evaluation;
  children: EvaluationNode[];
  endTime?: number;
};

export type EvaluationListener = (node: Evaluation, flameGraph: FlameGraph) => void;
type FlameGraphs = { [key: string]: FlameGraph };

type InterceptorOnce = (evaluation: Evaluation) => boolean;

const { apply, call } = Function;

export class ObservableContext extends MetaesContext {
  private _listeners: EvaluationListener[] = [];
  private _handlers: Map<any, Traps[]> = new Map();
  private _flameGraphs: FlameGraphs = {};

  constructor(target: object, mainTraps?: Traps) {
    super(
      undefined,
      undefined,
      { values: { this: target, self: target } },
      {
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
      },
      createCache()
    );

    if (mainTraps) {
      this._addTraps(target, mainTraps);
    }
  }

  private _addTraps(target: any, traps: Traps) {
    const trapsCollection = this._handlers.get(target);
    if (trapsCollection) {
      trapsCollection.push(traps);
    } else {
      this._handlers.set(target, [traps]);
    }
  }

  private _getTraps(target: any) {
    return this._handlers.get(target);
  }

  addListener(listener: EvaluationListener) {
    this._listeners.push(listener);
  }

  removeListener(listener: EvaluationListener) {
    const index = this._listeners.indexOf(listener);
    this._listeners.splice(index, 1);
  }

  _interceptOnce(graph: FlameGraph, fn: InterceptorOnce) {
    graph.oneTimeInterceptors.push(fn);
  }

  addHandler(handler: ObserverHandler) {
    this._addTraps(handler.target, handler.traps);
  }

  interceptor(evaluation: Evaluation) {
    const flameGraph = this._flameGraphs[evaluation.script.scriptId];

    this._mainInterceptor(evaluation);
    for (let i = 0; i < flameGraph.oneTimeInterceptors.length; i++) {
      const interceptor = flameGraph.oneTimeInterceptors[i];
      let done = false;
      try {
        done = interceptor(evaluation);
      } catch (e) {
        console.error(e);
      } finally {
        if (done) {
          flameGraph.oneTimeInterceptors.splice(i, 1);
        }
      }
    }
  }

  _mainInterceptor(evaluation: Evaluation) {
    const flameGraph = this._flameGraphs[evaluation.script.scriptId];
    const getValue = e => flameGraph.values.get(e);

    // handler.set
    if (evaluation.phase === "enter" && evaluation.e.type === "SetProperty") {
      const { object, property, value } = evaluation.e;
      let traps;
      if ((traps = this._getTraps(object))) {
        traps.forEach(trap => trap.set && trap.set(object, property, value));
      }
    }

    if (evaluation.phase === "exit") {
      // handler.didSet
      if (evaluation.e.type === "AssignmentExpression") {
        const assignment = evaluation.e as any;

        const left = getValue(assignment.left.object);
        const traps = this._getTraps(left);
        if (left && traps) {
          traps.forEach(
            trap =>
              trap.didSet &&
              trap.didSet(
                left,
                getValue(assignment.left.property) || assignment.left.property.name,
                getValue(assignment.right)
              )
          );
        }
      }
    }

    // handler.apply
    if (evaluation.phase === "enter" && evaluation.e.type === "Apply") {
      const { fn, thisObj, args, e: callExpression } = evaluation.e as Apply;
      const object =
        callExpression.callee.type === "MemberExpression" ? getValue(callExpression.callee.object) : thisObj;

      let traps;
      if ((traps = this._getTraps(object))) {
        traps.forEach(trap => trap.apply && trap.apply(thisObj, fn, args));
      }

      if (fn === call && (traps = this._getTraps(args[0]))) {
        traps.forEach(trap => trap.apply && trap.apply(args[0], object, args.slice(1)));
      }

      if (fn === apply && (traps = this._getTraps(args[0]))) {
        traps.forEach(trap => trap.apply && trap.apply(args[0], object, args[1]));
      }
    }

    this._listeners.forEach(listener => listener(evaluation, flameGraph));
  }

  private _flameGraphBuilder(builderPhase: "before" | "after", evaluation: Evaluation) {
    const {
      phase,
      script: { scriptId }
    } = evaluation;
    const flameGraph =
      this._flameGraphs[scriptId] ||
      (this._flameGraphs[scriptId] = {
        executionStack: [],
        oneTimeInterceptors: [],
        values: new Map()
      });
    const stack = flameGraph.executionStack;

    if (builderPhase === "before") {
      if (phase === "enter") {
        const node: EvaluationNode = {
          evaluation,
          children: []
        };
        const parent = stack[stack.length - 1];
        if (parent) {
          const value = parent.children.push(node);

          // Manually run trap
          let traps: Traps[] | undefined;
          if ((traps = this._getTraps(parent.children))) {
            traps.forEach(trap => trap.apply && trap.apply(parent.children, parent.children.push, [node], value));
          }
        }

        const value = stack.push(node);

        // Manually run trap
        let traps: Traps[] | undefined;
        if ((traps = this._getTraps(stack))) {
          traps.forEach(trap => trap.apply && trap.apply(stack, stack.push, [node], value));
        }
      } else {
        flameGraph.values.set(evaluation.e, evaluation.value);
      }
    }
    if (builderPhase === "after" && phase === "exit") {
      stack.pop();
    }
  }
}
