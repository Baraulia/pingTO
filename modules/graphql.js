// modules/graphql.js
export class GraphQLManager {
  static async execute(endpoint, query, variables = {}, headers = {}) {
    const body = JSON.stringify({
      query,
      variables
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body
    });

    const data = await response.json();
    return data;
  }

  static formatQuery(query) {
    // Простое форматирование для отображения
    return query.trim();
  }

  static validateQuery(query) {
    try {
      // Проверка на наличие query или mutation
      if (!query.includes('query') && !query.includes('mutation')) {
        throw new Error('Query must contain "query" or "mutation"');
      }
      return true;
    } catch (error) {
      return error.message;
    }
  }
}