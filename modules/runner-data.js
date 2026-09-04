export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const s = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      cell += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = r[idx] ?? '';
    });
    return obj;
  }).filter((o) => Object.keys(o).length);
}

export function flattenRunnerRow(row) {
  const out = {};
  if (!row || typeof row !== 'object' || Array.isArray(row)) return out;
  Object.entries(row).forEach(([key, value]) => {
    if (value == null) out[key] = '';
    else if (typeof value === 'object') out[key] = JSON.stringify(value);
    else out[key] = String(value);
  });
  return out;
}

export function parseRunnerData(text, filename = '') {
  const raw = String(text || '').trim();
  if (!raw) return [{}];
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.json')) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Invalid runner data');
    }
    return rowsFromJson(data);
  }
  if (lower.endsWith('.csv') || (!raw.startsWith('[') && !raw.startsWith('{') && raw.includes(','))) {
    const rows = parseCsv(raw);
    if (!rows.length) throw new Error('Runner data has no rows');
    return rows;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid runner data');
  }
  return rowsFromJson(data);
}

function rowsFromJson(data) {
  if (Array.isArray(data)) {
    const rows = data.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
    if (!rows.length) throw new Error('Runner data has no rows');
    return rows;
  }
  if (data && typeof data === 'object') return [data];
  throw new Error('Runner data has no rows');
}
