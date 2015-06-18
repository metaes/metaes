/**
 * (Line, column) pair used in @ASTNode.
 */
interface RowCol {
  line: string,
  column:string;
}

/**
 * Node in AST tree produced by parser.
 */
export class ASTNode {
  type:string;
  range:[number, number];
  loc:{start: RowCol, end: RowCol};

  // substring of original source of script for this particular node.
  subProgram:string;
}

/**
 * Metacircular function representation in MetaES VM.
 */
interface MetaFunction extends Function {
  e: ASTNode;
  env: Env;
  cfg: EvaluationConfig;
}


/**
 * Key-valued object of all the names in existing environment (scope).
 */
export interface SimpleEnv {
  [key: string]: any
}

/**
 * Complex environment case.
 * For example:
 *
 * var
    env = {
        names: {
          // give `a` and `b` as variables to the VM
          a: '1',
          b: '2',

          // `parseInt` is instrumented with additional JavaScript code
          // that is run natively. But could be run metacircullary as well
          parseInt: function () {
            console.log('instrumented parseInt is called with arguments:', [].join.call(arguments, ", "));

            // and call the original `parseInt`, from current window
            return parseInt.apply(null, arguments);
          },
          console: console
        },
        prev: {
          names: window
        }
      };
 metaes.evaluate('parseInt("10px")', env);
 */
export interface ComplexEnv {
  prev:Env;
  names:SimpleEnv;
  cfg:EvaluationConfig;

  // reference to metacircular function that was called and produced new scope od execution.
  fn?: MetaFunction

  // Reference to closure of `fn` function
  closure?: ComplexEnv
}

/**
 * Environment can be both simple or complex.
 */
export type Env = SimpleEnv | ComplexEnv;

interface SuccessCallback {
  (ast:ASTNode, value:any): void;
}

interface ErrorCallback {
  (ast:ASTNode, errorType:String, error:Error): void;
}

/**
 * When pause() is called it returns function that should be used for resuming the execution. For example:
 *
 * var resume = pause();
 * setTimeout(resume, 1000, "resumeValue");
 */
interface Interceptor {
  (e:ASTNode, val:any, env:Env, pause?:() => (resumeValue:any) => void):void;
}

interface EvaluationConfig {
  interceptor: Interceptor;

  // name of the VM, can be filename or just any arbitrary name.
  // Leaving it undefined will by default assign name like VMx where `x` is next natural number.
  name?: string
}

declare
var metaes:{
  /**
   * Evaluates program given in source.
   * @param source - JavaScript program source or function reference
   * @param env - object containing key-value pairs that will be enviroment for the program.
   *              I can be for example just `window`/`global`, or `{a: 1, b:2}`,
   *              or environment that has previous (outer) environment and that environment
   * @param cfg - configuration for this VM
   * @param success - function that will be called if evaluation finishes successfully
   * @param error - function that will be called if evaluation finishes with an error (`SyntaxError`, `ReferenceError` of any kind of exception)
   */
  evaluate: (source:String | Function, env?:Env, cfg?:EvaluationConfig, success?:SuccessCallback, error?:ErrorCallback) => any;
};