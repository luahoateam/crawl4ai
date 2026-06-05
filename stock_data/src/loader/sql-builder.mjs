export function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    // Escape single quotes by doubling them according to SQLite standard
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'object') {
    // For arrays or sub-objects, serialize to JSON string and escape
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${value.toString().replace(/'/g, "''")}'`;
}

export function buildInsertSql(tableName, data) {
  const keys = Object.keys(data);
  const cols = keys.join(', ');
  const vals = keys.map(k => escapeSqlValue(data[k])).join(', ');
  
  return `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${vals});`;
}
