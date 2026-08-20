export class GraphQLManager {
  static buildPayload(query, variables = {}) {
    return JSON.stringify({ query, variables });
  }

  static parseVariables(raw) {
    const text = (raw || '').trim();
    if (!text) return {};
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('GraphQL variables must be a JSON object');
    }
    return parsed;
  }

  static formatQuery(query) {
    return (query || '').trim();
  }

  static validateQuery(query) {
    const text = (query || '').trim();
    if (!text) return 'Query is empty';
    if (!/\b(query|mutation|subscription|\{)/i.test(text)) {
      return 'Query must contain an operation or a selection set';
    }
    return true;
  }
}
