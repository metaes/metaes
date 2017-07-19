import { describe, it } from 'mocha';
import { MetaESContext } from '../../lib/metaes';
import { environmentToJSON } from '../../lib/remote';
import { assert } from 'chai';

describe('Environment', () => {
  it('should convert environment back and forth', () => {
    let env = { values: { console } };
    let context = new MetaESContext(env);
    console.log(environmentToJSON(context, env));
  });
});
