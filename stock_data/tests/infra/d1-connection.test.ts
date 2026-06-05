import { describe, it, expect } from 'vitest';
import { testDb } from '../helpers/db';

describe('D1 Database Connection', () => {
  it('should connect to D1 local and run query', async () => {
    const result = await testDb.run("SELECT 1 as alive");
    expect(result.results[0]).toEqual({ alive: 1 });
  });
});
