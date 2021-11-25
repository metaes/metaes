// test: imports whole module
import a from "./a";

assert.equal(a(), "default");

// test: imports named export
import { a } from "./a";

assert.equal(a(), 44);

// test: imports named export with aliased name
import { a as _ } from "./a";

assert.equal(_(), 44);

// test: supports multi levels imports
import { c } from "./a";

assert.equal(c(), 88);
