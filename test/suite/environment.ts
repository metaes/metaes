import { describe, it } from 'mocha';
import { MetaESContext } from '../../lib/metaes';
import { environmentToJSON, environmentFromJSON } from '../../lib/remote';
import { assert } from 'chai';

describe('Environment', () => {
  it('should convert environment back and forth', () => {
    let env = { values: { encodeURI, a: 'teststring' } };
    let context = new MetaESContext(env);
    let to = environmentToJSON(context, env);
    console.log('to', to);
    assert.equal(environmentFromJSON(context, to).values['encodeURI'], encodeURI);
  });
});
