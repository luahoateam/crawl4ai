import fs from 'fs';
import path from 'path';

let mapping = null;

function loadMapping() {
  if (mapping) return mapping;
  try {
    const filePath = path.resolve('business_mapping.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      mapping = JSON.parse(content);
    } else {
      mapping = {};
    }
  } catch (error) {
    console.error(`Failed to load business_mapping.json: ${error.message}`);
    mapping = {};
  }
  return mapping;
}

export function classify(ticker) {
  const map = loadMapping();
  const upperTicker = ticker.toUpperCase();
  return map[upperTicker] || 'general';
}
