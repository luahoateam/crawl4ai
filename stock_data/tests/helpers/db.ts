import { execSync } from 'child_process';

export const testDb = {
  async run(query: string): Promise<any> {
    try {
      // Escape double quotes for Windows CLI safety
      const escapedQuery = query.replace(/"/g, '\\"');
      const output = execSync(
        `npx wrangler d1 execute stock_db --command="${escapedQuery}" --local --json`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      
      const parsed = JSON.parse(output);
      // If Wrangler returns an array of batch query results, extract the first one
      if (Array.isArray(parsed)) {
        return parsed[0];
      }
      return parsed;
    } catch (error: any) {
      throw new Error(`Failed to execute query: ${error.message}`);
    }
  }
};
