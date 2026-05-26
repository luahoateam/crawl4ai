import test from 'node:test';
import assert from 'node:assert';

// Cố gắng import module d1_sync.mjs (sẽ báo lỗi ở Red Phase vì file chưa tồn tại)
import * as d1_sync from '../scripts/d1_sync.mjs';

test('D1 Sync Client - syncBusinessModel should call fetch with correct arguments', async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  let capturedUrl = '';
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    fetchCalled = true;
    capturedUrl = url;
    capturedOptions = options;
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true })
    };
  };

  try {
    const symbol = 'AAA';
    const data = {
      revenueStruct: 'Bao bì 80%',
      profitStruct: 'Bao bì 30%'
    };

    const result = await d1_sync.syncBusinessModel(symbol, data, {
      apiKey: 'test-api-key',
      apiBaseUrl: 'http://test-api/api'
    });

    assert.strictEqual(result, true);
    assert.strictEqual(fetchCalled, true);
    assert.strictEqual(capturedUrl, 'http://test-api/api/companies/AAA/business-model');
    assert.strictEqual(capturedOptions.method, 'PUT');
    assert.strictEqual(capturedOptions.headers['X-API-Key'], 'test-api-key');
    assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');
    
    const body = JSON.parse(capturedOptions.body);
    assert.strictEqual(body.revenueStruct, 'Bao bì 80%');
    assert.strictEqual(body.profitStruct, 'Bao bì 30%');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('D1 Sync Client - syncBusinessModel should retry on 5xx errors', async (t) => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (url, options) => {
    callCount++;
    if (callCount < 3) {
      return { status: 500, ok: false, text: async () => 'Internal Server Error' };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true })
    };
  };

  try {
    const result = await d1_sync.syncBusinessModel('AAA', {}, {
      apiKey: 'test-api-key',
      apiBaseUrl: 'http://test-api/api',
      retryDelayMs: 1 // Giảm thời gian chờ để test chạy nhanh
    });

    assert.strictEqual(result, true);
    assert.strictEqual(callCount, 3); // 2 lần fail + 1 lần thành công
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('D1 Sync Client - syncBusinessModel should fail after max retries', async (t) => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (url, options) => {
    callCount++;
    return { status: 502, ok: false, text: async () => 'Bad Gateway' };
  };

  try {
    await assert.rejects(
      async () => {
        await d1_sync.syncBusinessModel('AAA', {}, {
          apiKey: 'test-api-key',
          apiBaseUrl: 'http://test-api/api',
          retryDelayMs: 1,
          maxRetries: 3
        });
      },
      /Failed to sync business model for AAA after 3 attempts/
    );
    assert.strictEqual(callCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
