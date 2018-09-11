import { Environment, getValueTag, setValueTag } from "./environment";
import { MetaesContext } from "./metaes";
import { ASTNode } from "./nodes/nodes";
import { Identifier, MemberExpression, AssignmentExpression } from "./nodeTypes";
import { Evaluation } from "./types";

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
};

type EvaluationListener = (node: Evaluation, flameGraph: FlameGraph) => void;
type FlameGraphs = { [key: string]: FlameGraph };

type InterceptorOnce = (evaluation: Evaluation) => boolean;

const { apply, call } = Function;

export class ObservableContext extends MetaesContext {
  private _listeners: EvaluationListener[] = [];
  private _handlers: ObserverHandler[] = [];
  private _flameGraphs: FlameGraphs = {};

  constructor(target: object, mainHandler?: Traps) {
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
      }
    );
    ["self", "this"].forEach(name => setValueTag(this.environment, name, "observable", true));

    if (mainHandler) {
      this._handlers.push({ traps: mainHandler, target });
    }
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
    this._handlers.push(handler);
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
    if (evaluation.phase === "enter" && evaluation.e.type === "AssignmentExpression") {
      const assignment = evaluation.e as AssignmentExpression;
      let left;

      let right;
      this._interceptOnce(flameGraph, evaluation => {
        let leftProperty;
        if (
          assignment.left.type === "MemberExpression" &&
          assignment.left.computed &&
          !(leftProperty = getValue(assignment.left.property))
        ) {
          return false;
        }
        if (
          evaluation.phase === "exit" &&
          (left = getValue(assignment.left.object)) &&
          (right = getValue(assignment.right))
        ) {
          for (let i = 0; i < this._handlers.length; i++) {
            const handler = this._handlers[i];
            if (handler.target === left && handler.traps.set) {
              handler.traps.set(left, leftProperty || assignment.left.property.name, getValue(assignment.right));
            }
          }
          return true;
        }
        return false;
      });
    }

    if (evaluation.phase === "exit") {
      // handler.didSet
      if (evaluation.e.type === "AssignmentExpression") {
        const assignment = evaluation.e as any;

        const left = getValue(assignment.left.object);
        if (left) {
          for (let i = 0; i < this._handlers.length; i++) {
            const handler = this._handlers[i];
            if (handler.target === left && handler.traps.didSet) {
              handler.traps.didSet(
                left,
                getValue(assignment.left.property) || assignment.left.property.name,
                getValue(assignment.right)
              );
            }
          }
        }
      }

      // handler.apply
      if (evaluation.e.type === "CallExpression") {
        // TODO: assuming here call using member expression
        const callNode = evaluation.e as any;
        const callNodeValue = getValue(callNode);
        const object = getValue(callNode.callee.object);
        const property = getValue(callNode.callee);
        const args: any[] = callNode.arguments.map(getValue);

        for (let i = 0; i < this._handlers.length; i++) {
          const handler = this._handlers[i];
          if (handler.traps.apply) {
            if (handler.target === object) {
              handler.traps.apply(object, property, args, callNodeValue);
            } else if (
              // in this case check if function is called using .call or .apply with
              // `this` equal to `observer.target`
              args[0] === handler.target
            ) {
              if (property === apply) {
                handler.traps.apply(args[0], object, args[1], callNodeValue);
              } else if (property === call) {
                handler.traps.apply(args[0], object, args.slice(1), callNodeValue);
              }
            }
          }
        }
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
          parent.children.push(node);
        }
        stack.push(node);
      } else {
        flameGraph.values.set(evaluation.e, evaluation.value);
      }
    }
    if (builderPhase === "after" && phase === "exit") {
      stack.pop();
    }
  }
}

const isMemberExpression = (e: ASTNode): e is MemberExpression => e.type === "MemberExpression";

function getTopObject(e: ASTNode) {
  if (isMemberExpression(e)) {
    return getTopObject(e.object);
  } else {
    return e;
  }
}

export type ObservableResult = { object: any; property?: string };

export const createListenerToCollectObservables = (
  resultsCallback: (result: ObservableResult) => void,
  environment: Environment
): EvaluationListener => ({ e, phase }, graph) => {
  if (phase === "exit") {
    const stack = graph.executionStack;

    // Ignore checking when sitting inside deeper member expression
    if (stack.length > 1 && stack[stack.length - 2].evaluation.e.type === "MemberExpression") {
      return;
    }
    if (isMemberExpression(e) && getValueTag(environment, getTopObject(e.object).name, "observable")) {
      const property = e.computed ? graph.values.get(e.property) : e.property.name;
      resultsCallback({ object: graph.values.get(e.object), property });
    } else if (e.type === "Identifier") {
      if (getValueTag(environment, (<Identifier>e).name, "observable")) {
        resultsCallback({ object: graph.values.get(e) });
      }
    }
  }
};
