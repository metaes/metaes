import * as glob from 'glob';
import * as fs from 'fs-extra';
import * as pify from 'pify';
import { describe, it, before } from 'mocha';
import { assert } from 'chai';
import { zip } from 'lodash';
import { metaESEval } from '../../lib/metaes';

const evaluate = (input: string) =>
  new Promise((resolve, reject) =>
    metaESEval(
      input,
      global,
      { errorCallback: reject },
      success => resolve(success.value),
      error => reject(error.originalError)
    )
  );

(async () => {
  try {
    describe('Truthiness tests', async () => {
      // generate tests on runtime
      before(async () => {
        let files = (await pify(glob)(__dirname + './../truthiness/**/*.ts')).map(async file => ({
          name: file,
          contents: (await fs.readFile(file)).toString(),
        }));

        return (await Promise.all(files)).forEach(({ contents, name }) => {
          let testNames = contents.match(/\/\/[^\n]+\n/g);
          let tests = contents.split(/\/\/.+\n/).filter(line => line.length);
          let suiteName = name.substring(name.lastIndexOf('/') + 1);

          describe(suiteName, () => {
            zip(testNames, tests).forEach(([name, value]) => {
              let testName = name.replace('//', '').trim();
              it(testName, async () => {
                return assert.isTrue(!!await evaluate(value));
              });
            });
          });
        });
      });

      // it is a placeholder to force mocha to run `before` function
      it('noop', () => {});
    });
  } catch (e) {
    console.log(e);
  }
})();
