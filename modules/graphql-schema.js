const INTROSPECTION = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      name
      kind
      fields {
        name
        args { name }
        type { name kind ofType { name kind ofType { name kind } } }
      }
    }
  }
}`;

export function unwrapType(t) {
  while (t && t.ofType) t = t.ofType;
  return t?.name || '';
}

export function flattenFields(schema) {
  const fields = [];
  (schema?.types || []).forEach((type) => {
    (type.fields || []).forEach((field) => {
      fields.push({
        type: type.name,
        name: field.name,
        returns: unwrapType(field.type),
      });
    });
  });
  return fields;
}

export async function introspect(endpoint, headers = {}) {
  const response = await chrome.runtime.sendMessage({
    type: 'sendRequest',
    data: {
      method: 'POST',
      url: endpoint,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query: INTROSPECTION }),
    },
  });
  const json = JSON.parse(response.body || '{}');
  if (json.errors) throw new Error(json.errors[0]?.message || 'Introspection failed');
  return json.data?.__schema;
}

export function suggestGraphql(schema, word) {
  if (!schema || !word) return [];
  const w = word.toLowerCase();
  return flattenFields(schema)
    .filter((f) => f.name.toLowerCase().includes(w))
    .slice(0, 12);
}
