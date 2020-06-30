import { createScript, metaesEval } from "./metaes";

const source = `function run(){
  2 + lol / 4;
}
run();`;

const script = createScript(source);
script.url = `test/from-html.spec.ts`;

metaesEval(source, console.log, function (error) {
  console.log(error);
});
