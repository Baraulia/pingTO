import { describe, expect, it } from 'vitest';
import { GraphQLManager } from '../../modules/graphql.js';
import { flattenFields, unwrapType } from '../../modules/graphql-schema.js';

describe('graphql helpers', () => {
  it('builds payloads and parses variables', () => {
    expect(JSON.parse(GraphQLManager.buildPayload('query { ping }', { id: 1 }))).toEqual({
      query: 'query { ping }',
      variables: { id: 1 },
    });
    expect(GraphQLManager.parseVariables('{"id":"7"}')).toEqual({ id: '7' });
    expect(GraphQLManager.validateQuery('query { ping }')).toBe(true);
    expect(GraphQLManager.validateQuery('')).not.toBe(true);
  });

  it('unwraps nested GraphQL types', () => {
    expect(unwrapType({ name: null, ofType: { name: 'User' } })).toBe('User');
    expect(flattenFields({
      types: [{ name: 'Query', fields: [{ name: 'ping', type: { name: 'String' } }] }],
    })).toEqual([{ type: 'Query', name: 'ping', returns: 'String' }]);
  });
});
