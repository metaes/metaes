import { evalToPromise, MetaesContext } from "./metaes";
import { Evaluation, Interceptor } from "./types";

type InterceptorTrap = {
  apply?: (target: object, methodName: string, args: any[]) => void;
  get?: (target: object, key: string, value: any) => void;
  set?: (target: object, key: string, args: any) => void;
};

type InterceptorProxy = {
  target: any;
  trap: InterceptorTrap;
};

export type ScriptHistory = { root: TrackingNode; path: TrackingNode[] };

type RootValue = "_context";
type TrackingNode = {
  evaluation: Evaluation | RootValue | string;
  children: TrackingNode[];
  namedChildren: { [key: string]: TrackingNode | TrackingNode[] };
};
type Tracker = (evaluation: Evaluation, tracking: ScriptHistory) => void;
type TrackingMap = { [key: string]: ScriptHistory };

export const createFlameInterceptor: (TrackingMap) => Interceptor = (trackingMap: TrackingMap) => (
  tag,
  e,
  value,
  env,
  timestamp,
  scriptId
) => {
  let tracking = trackingMap[scriptId];
  if (!tracking) {
    tracking = trackingMap[scriptId] = {
      path: [],
      root: {
        children: [],
        namedChildren: {},
        evaluation: "_context"
      }
    };
  }
  if (tag.phase === "enter") {
    const node: TrackingNode = {
      evaluation: tag.propertyKey ? tag.propertyKey : { e, value, env, tag, timestamp, scriptId },
      namedChildren: {},
      children: []
    };
    tracking.path.push(node);
    if (tracking.path.length > 1) {
      const parent = tracking.path[tracking.path.length - 2];
      parent.children.push(node);
      if (typeof parent.evaluation === "string" && tracking.path.length > 2) {
        const grandParent = tracking.path[tracking.path.length - 3];
        grandParent.namedChildren[parent.evaluation] = node;
      }
    } else {
      tracking.root.children.push(node);
    }
  } else {
    // exit
    tracking.path.pop();
  }
};

export class MetaesStore<T> {
  private _context: MetaesContext;
  private _trackers: Tracker[] = [];
  private _proxies: InterceptorProxy[] = [];
  private _tracking: TrackingMap = {};

  constructor(private _store: T, initialTrap?: InterceptorTrap) {
    const flameInterceptor = createFlameInterceptor(this._tracking);
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
    if (initialTrap) {
      this._proxies.push({ trap: initialTrap, target: _store });
    }
  }

  getStore() {
    return this._store;
  }

  addTracker(tracker: Tracker) {
    this._trackers.push(tracker);
  }

  interceptor(tag, e, value, env, timestamp, scriptId) {
    function pathIncludes(type, path: TrackingNode[]) {
      for (let i = path.length - 1; i >= 0; i--) {
        const element = path[i];
        if (typeof element.evaluation === "object" && element.evaluation.e.type === type) {
          console.log("has");
        }
      }
    }
    const tracking = this._tracking[scriptId];
    for (let i = 0; i < this._proxies.length; i++) {
      const proxy = this._proxies[i];
      if (proxy.target === value) {
        console.log(tracking);
        pathIncludes("AssignmentExpression", tracking.path);
      }
    }
    this._trackers.forEach(tracker => tracker({ tag, e, value, env, timestamp, scriptId }, tracking));
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
