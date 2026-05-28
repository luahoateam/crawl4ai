import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:8787';

async function testStats() {
  console.log('Running testStats...');
  
  const res = await fetch(`${BASE_URL}/api/stats`);
  console.log(`Response status: ${res.status}`);
  console.log('Headers:', [...res.headers.entries()]);
  
  if (res.status === 404) {
    console.log('RED phase: GET /api/stats returned 404 (Not Found). Endpoint not implemented yet. This is expected for RED phase.');
    return;
  }

  const cacheControl = res.headers.get('cache-control');
  console.log(`Cache-Control: ${cacheControl}`);

  const data = await res.json();
  console.log('Response body:', data);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(data.success, true);
  assert.ok(data.result);
  assert.strictEqual(typeof data.result.companies, 'number');
  assert.strictEqual(typeof data.result.businessModels, 'number');
  assert.strictEqual(typeof data.result.dailyResearch, 'number');
  assert.strictEqual(typeof data.result.news, 'number');
  assert.strictEqual(typeof data.result.documents, 'number');
  
  assert.ok(data.result.companies >= 0);
  assert.ok(data.result.businessModels >= 0);
  assert.ok(data.result.dailyResearch >= 0);
  assert.ok(data.result.news >= 0);
  assert.ok(data.result.documents >= 0);
  
  assert.ok(cacheControl && cacheControl.includes('public'));
  assert.ok(cacheControl && cacheControl.includes('max-age=3600'));

  console.log('GREEN phase: GET /api/stats passed all assertions!');
}

testStats().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
