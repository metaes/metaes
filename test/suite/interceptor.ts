import { describe, it } from 'mocha';
import { assert } from 'chai';
import { metaESEval } from '../../lib/metaes';
import { Evaluation } from '../../lib/types';

describe('Interceptor', () => {
  it('should be called', () => {
    let evaluations: Evaluation[] = [];
    function errorCallback(e) {
      console.log(e);
    }
    function interceptor(e: Evaluation) {
      evaluations.push(e);
    }
    metaESEval('2', {}, { interceptor, errorCallback });
    assert.equal(evaluations.length, 6);
  });
});
