package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func handleGraphQL(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	var req struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}
	if err := json.Unmarshal(raw, &req); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{"message": "invalid json"}}})
		return
	}
	q := strings.TrimSpace(req.Query)
	if strings.Contains(q, "__schema") || strings.Contains(q, "IntrospectionQuery") {
		writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"__schema": gqlSchema()}})
		return
	}
	if strings.Contains(q, "users") && !strings.Contains(q, "user(") {
		writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"users": []map[string]any{{"id": "1", "name": "Ada"}, {"id": "2", "name": "Linus"}},
		}})
		return
	}
	if strings.Contains(q, "user") {
		id := "1"
		if req.Variables != nil {
			if v, ok := req.Variables["id"]; ok {
				id = stringify(v)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"user": map[string]any{"id": id, "name": "user-" + id},
		}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"ping": "pong", "__typename": "Query"}})
}

func stringify(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strings.TrimSuffix(strings.TrimSuffix(jsonNumber(t), ".0"), ".")
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func jsonNumber(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}

func gqlSchema() map[string]any {
	str := map[string]any{"name": "String", "kind": "SCALAR", "ofType": nil}
	idT := map[string]any{"name": "ID", "kind": "SCALAR", "ofType": nil}
	nn := func(t map[string]any) map[string]any {
		return map[string]any{"name": nil, "kind": "NON_NULL", "ofType": t}
	}
	return map[string]any{
		"queryType":    map[string]any{"name": "Query"},
		"mutationType": nil,
		"types": []map[string]any{
			{
				"name": "Query",
				"kind": "OBJECT",
				"fields": []map[string]any{
					{"name": "ping", "args": []any{}, "type": str},
					{"name": "user", "args": []map[string]any{{"name": "id"}}, "type": map[string]any{"name": "User", "kind": "OBJECT", "ofType": nil}},
					{"name": "users", "args": []any{}, "type": map[string]any{"name": nil, "kind": "LIST", "ofType": map[string]any{"name": "User", "kind": "OBJECT"}}},
				},
			},
			{
				"name": "User",
				"kind": "OBJECT",
				"fields": []map[string]any{
					{"name": "id", "args": []any{}, "type": nn(idT)},
					{"name": "name", "args": []any{}, "type": str},
				},
			},
		},
	}
}
