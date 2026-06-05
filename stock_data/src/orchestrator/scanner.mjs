import { glob } from 'glob';
import path from 'path';

export async function scanOcrDirectory(dirPath) {
  // Normalize path separators to forward slashes for glob safety
  const normalizedPath = path.resolve(dirPath).replace(/\\/g, '/');
  const files = await glob(`${normalizedPath}/**/*_extracted.txt`);
  
  return files.map(file => {
    // Standardize path representation
    const absolutePath = path.resolve(file);
    const relative = path.relative(dirPath, absolutePath).replace(/\\/g, '/');
    const parts = relative.split('/');
    
    // Extract metadata from folder structure
    // Expected parts format: [TICKER, YEAR, FOLDER_NAME, FILE_extracted.txt]
    const ticker = parts[0] || 'UNKNOWN';
    const year = parseInt(parts[1], 10) || null;
    const folderName = parts[2] || '';
    
    let reportType = 'consolidated';
    const lowerFolder = folderName.toLowerCase();
    if (lowerFolder.includes('congtyme') || lowerFolder.includes('riengle') || lowerFolder.includes('rieng')) {
      reportType = 'parent';
    } else if (lowerFolder.includes('hopnhat')) {
      reportType = 'consolidated';
    }
    
    return {
      filePath: absolutePath,
      ticker,
      year,
      reportType
    };
  });
}
