/**
 * Converts a snake_case string to camelCase.
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Maps a single object or an array of objects to camelCase keys recursively.
 */
export function toCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item)) as any;
  }
  
  if (typeof obj === 'object') {
    // If it's a Date or other primitive-like object, return as-is
    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = toCamelCase(value);
    }
    return result as T;
  }
  
  return obj;
}
