import { evalToPromise, MetaesContext } from "./metaes";
import { Evaluation } from "./types";

type InterceptorTrap = {
  apply?: (target: object, methodName: string, args: any[]) => void;
  get?: (target: object, key: string, value: any) => void;
  set?: (target: object, key: string, args: any) => void;
};

type InterceptorProxy = {
  target: any;
  trap: InterceptorTrap;
};

export type ScriptTracking = { root: FlameNode; path: FlameNode[] };
type RootValue = "_context";
type FlameNode = { value: Evaluation | RootValue; children: FlameNode[]; size?: any };
type Tracker = (evaluation: Evaluation, tracking: ScriptTracking) => void;
type TrackingMap = { [key: string]: ScriptTracking };

export const createFlameInterceptor = (trackingMap: TrackingMap) => (evaluation: Evaluation) => {
  let tracking = trackingMap[evaluation.scriptId];
  if (!tracking) {
    tracking = trackingMap[evaluation.scriptId] = {
      path: [],
      root: {
        children: [],
        value: "_context"
      }
    };
  }
  if (evaluation.tag.phase === "enter") {
    evaluation.timestamp = window.performance.now();
    const node: FlameNode = {
      value: evaluation,
      children: []
    };
    tracking.path.push(node);
    if (tracking.path.length > 1) {
      tracking.path[tracking.path.length - 2].children.push(node);
    } else {
      tracking.root.children.push(node);
    }
  } else {
    // exit
    const enterNode = tracking.path.pop();
    if (tracking.path.length === 0) {
      //delete tracking.root;
    }
    if (enterNode) {
      //console.log(enterNode.value.e.type, evaluation.e.type)
      enterNode.size = [enterNode.value.timestamp, window.performance.now()];
    }
  }
};

export class MetaesStore<T> {
  private _context: MetaesContext;
  private _trackers: Tracker[] = [];
  private _proxies: InterceptorProxy[] = [];
  private _tracking: TrackingMap = {};

  constructor(private store: T, initialTrap?: InterceptorTrap) {
    const flameInterceptor = createFlameInterceptor(this._tracking);
    const config = {
      interceptor: e => {
        flameInterceptor(e);
        this.interceptor(e);
      }
    };
    this._context = new MetaesContext(
      this.c.bind(this),
      this.cerr.bind(this),
      { values: { store: this.store, console } },
      config
    );
    if (initialTrap) {
      this._proxies.push({ trap: initialTrap, target: store });
    }
  }

  addTracker(tracker: Tracker) {
    this._trackers.push(tracker);
  }

  interceptor(evaluation: Evaluation) {
    function pathIncludes(type, path: FlameNode[]) {
      for (let i = path.length - 1; i >= 0; i--) {
        const element = path[i];
        if (element.value && element.value.e.type === type) {
          console.log("has");
        }
      }
    }
    const tracking = this._tracking[evaluation.scriptId];
    for (let i = 0; i < this._proxies.length; i++) {
      const proxy = this._proxies[i];
      if (proxy.target === evaluation.value) {
        console.log(tracking);
        pathIncludes("AssignmentExpression", tracking.path);
      }
    }
    this._trackers.forEach(tracker => tracker(evaluation, tracking));
  }

  async evaluate(source: ((store: T, ...rest) => void), ...args: any[]) {
    return (await evalToPromise(this._context, source)).apply(null, [this.store].concat(args));
  }

  c(e) {
    console.log("ok:", e);
  }

  cerr(exception) {
    console.log("exception:", exception);
  }
}
