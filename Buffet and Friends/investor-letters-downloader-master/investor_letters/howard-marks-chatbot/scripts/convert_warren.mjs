#!/usr/bin/env npx zx

import { glob } from 'zx';
import path from 'path';

const SOURCE_DIR = '../full_data/01_warren_buffett';

async function main() {
  console.log(`Scanning source directory: ${SOURCE_DIR}`);
  
  const files = await glob('*.{html,pdf}', { cwd: SOURCE_DIR });
  
  console.log(`Found ${files.length} files.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
