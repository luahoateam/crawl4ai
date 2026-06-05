import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execAsync = util.promisify(exec);

export async function runExtractor({ filePath, ticker, businessModel, apiKey }) {
  const pythonExec = '.venv/Scripts/python.exe';
  const scriptPath = 'python/extract.py';
  const tokenPath = 'xiaomi_token.txt';
  
  // Construct clean command with relative paths to prevent Windows path encoding issues
  const cmd = `"${pythonExec}" "${scriptPath}" --file "${filePath}" --model "${businessModel}" --token-file "${tokenPath}"`;
  
  try {
    const processEnv = {
      ...process.env,
      PYTHONPATH: 'python',
      PYTHONIOENCODING: 'utf-8',
      XIAOMI_API_KEY: apiKey || ''
    };
    
    // Execute command with increased buffer to support large BCTC JSON outputs
    const { stdout, stderr } = await execAsync(cmd, { 
      env: processEnv, 
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const output = stdout.trim();
    if (!output) {
      throw new Error("Extractor CLI returned empty stdout");
    }
    
    return JSON.parse(output);
  } catch (error) {
    const stderr = error.stderr || '';
    throw new Error(`Python extraction subprocess failed for ${ticker}. Error: ${error.message}. Stderr: ${stderr}`);
  }
}
