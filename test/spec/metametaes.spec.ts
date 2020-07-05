// import { describe, it } from "mocha";
import { presentException as presentedException } from "../../lib/exceptions";
import { createScript } from "../../lib/metaes";
import { importTSModule } from "../../lib/metametaes";

async function f() {
  try {
    const metaes = await importTSModule("lib/metaes.ts");
    const script = createScript("5+5*5");
    metaes.metaesEval(script, console.log, (exception) => {
      console.log(presentedException(exception));
    });
  } catch (error) {
    console.log(error);
  }
}
f();

// describe.only("Meta MetaES", function () {
//   it("test", async function () {
//     try {
//       const metaes = await importTSModule("lib/metaes.ts");
//       // console.log({ metaes });
//       const script = createScript("2+2");
//       metaes.metaesEval[0](script, console.log, (exception) => {
//         console.log(presentedException(script, exception));
//       });
//     } catch (error) {
//       console.log(error);
//     }
//   });
// });
