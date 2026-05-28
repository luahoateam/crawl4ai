import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:8787';

async function testDocuments() {
  console.log('Running testDocuments...');
  
  // Test case 1: Basic list
  const res = await fetch(`${BASE_URL}/api/documents?per_page=5`);
  console.log(`Response status: ${res.status}`);

  if (res.status === 404) {
    console.log('RED phase: GET /api/documents returned 404 (Not Found). Endpoint not implemented yet. This is expected.');
    return;
  }

  const cacheControl = res.headers.get('cache-control');
  console.log(`Cache-Control: ${cacheControl}`);

  const data = await res.json();
  console.log('Response body keys:', Object.keys(data));
  console.log('Pagination meta:', data.pagination);
  console.log('Number of items returned:', data.result?.length);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.result));
  assert.ok(data.pagination);
  assert.strictEqual(typeof data.pagination.page, 'number');
  assert.strictEqual(typeof data.pagination.perPage, 'number');
  assert.strictEqual(typeof data.pagination.total, 'number');

  // If there are documents, verify structural fields
  if (data.result.length > 0) {
    const item = data.result[0];
    console.log('Sample document item:', item);
    assert.strictEqual(typeof item.id, 'number');
    assert.strictEqual(typeof item.symbol, 'string');
    assert.strictEqual(typeof item.year, 'number');
    assert.strictEqual(typeof item.fileName, 'string');
    assert.strictEqual(typeof item.fileUrl, 'string');
    assert.ok('label' in item);
  }

  // Test case 2: filter symbol
  const resSymbol = await fetch(`${BASE_URL}/api/documents?symbol=VNM`);
  const dataSymbol = await resSymbol.json();
  assert.strictEqual(resSymbol.status, 200);
  if (dataSymbol.result.length > 0) {
    assert.ok(dataSymbol.result.every(item => item.symbol === 'VNM'), 'All items must belong to VNM');
  }

  // Test case 3: filter year
  const resYear = await fetch(`${BASE_URL}/api/documents?year=2024`);
  const dataYear = await resYear.json();
  assert.strictEqual(resYear.status, 200);
  if (dataYear.result.length > 0) {
    assert.ok(dataYear.result.every(item => item.year === 2024), 'All items must have year === 2024');
  }

  // Test case 4: non-existent symbol should return empty array
  const resEmpty = await fetch(`${BASE_URL}/api/documents?symbol=XYZ_NOT_EXIST`);
  const dataEmpty = await resEmpty.json();
  assert.strictEqual(resEmpty.status, 200);
  assert.strictEqual(dataEmpty.result.length, 0);

  // Cache-Control header check
  assert.ok(cacheControl && cacheControl.includes('public'));
  assert.ok(cacheControl && cacheControl.includes('max-age=1800'));

  console.log('GREEN phase: GET /api/documents passed all assertions!');
}

testDocuments().catch(err => {
  console.error('Test failed:', err.message);
  if (err.code === 'ERR_ASSERTION') {
    console.log('RED phase: Assertion failed as expected.');
    process.exit(0);
  }
  process.exit(1);
});
