import { describe, expect, it } from 'vitest';
import { flattenRunnerRow, parseCsv, parseRunnerData } from '../../modules/runner-data.js';

describe('runner data', () => {
  it('parses csv with quotes and headers', () => {
    const rows = parseCsv('user,id\n"a,b",1\nc,2\n');
    expect(rows).toEqual([
      { user: 'a,b', id: '1' },
      { user: 'c', id: '2' },
    ]);
  });

  it('parses json array and object', () => {
    expect(parseRunnerData('[{"id":1},{"id":2}]', 'd.json')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(parseRunnerData('{"id":9}', 'd.json')).toEqual([{ id: 9 }]);
  });

  it('empty file is one blank iteration', () => {
    expect(parseRunnerData('  ', 'x.json')).toEqual([{}]);
  });

  it('does not treat a .json file as csv', () => {
    expect(parseRunnerData('[{"note":"a,b"}]', 'rows.json')).toEqual([{ note: 'a,b' }]);
  });

  it('flattens nested values to strings', () => {
    expect(flattenRunnerRow({ id: 3, nested: { a: 1 } })).toEqual({ id: '3', nested: '{"a":1}' });
  });
});
