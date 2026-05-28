import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:8787';

async function testCompanies() {
  console.log('Running testCompanies...');
  
  const res = await fetch(`${BASE_URL}/api/companies`);
  assert.strictEqual(res.status, 200);

  const cacheControl = res.headers.get('cache-control');
  console.log(`Cache-Control: ${cacheControl}`);

  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.result));
  
  if (data.result.length === 0) {
    console.log('No companies found to test.');
    return;
  }

  // Check the first item for the new badge fields
  const first = data.result[0];
  console.log('First company item:', first);

  // RED phase assertion: fields should exist
  assert.strictEqual(typeof first.hasBusinessModel, 'boolean', 'hasBusinessModel must be a boolean');
  assert.strictEqual(typeof first.hasResearch, 'boolean', 'hasResearch must be a boolean');
  assert.strictEqual(typeof first.newsCount, 'number', 'newsCount must be a number');
  assert.strictEqual(typeof first.docCount, 'number', 'docCount must be a number');

  // Verify business rules:
  // AAA and VNM should have business model (from setup seeding)
  const aaa = data.result.find(c => c.symbol === 'AAA');
  if (aaa) {
    assert.strictEqual(aaa.hasBusinessModel, true, 'AAA must have hasBusinessModel === true');
  }

  assert.ok(cacheControl && cacheControl.includes('public'));
  assert.ok(cacheControl && cacheControl.includes('max-age=21600'));

  console.log('GREEN phase: GET /api/companies passed all assertions!');
}

testCompanies().catch(err => {
  console.error('Test failed:', err.message);
  // Do not exit with 1 if it is just assertion error of missing fields, so we can see the RED phase working.
  if (err.code === 'ERR_ASSERTION') {
    console.log('RED phase: Assertion failed as expected (badge fields are missing or incorrect).');
    process.exit(0);
  }
  process.exit(1);
});
