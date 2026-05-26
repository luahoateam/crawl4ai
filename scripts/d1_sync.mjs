import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải cấu hình từ file .env ở thư mục gốc nếu chưa được thiết lập trong process.env
function loadEnv() {
  if (process.env.API_KEY) return;
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key.trim()] = val;
      }
    }
  }
}

loadEnv();

/**
 * Gửi yêu cầu cập nhật business model lên API Worker với cơ chế tự động thử lại.
 * 
 * @param {string} symbol Mã cổ phiếu (ví dụ: AAA)
 * @param {object} data Dữ liệu đã định dạng (revenueStruct, profitStruct...)
 * @param {object} customOptions Cấu hình tùy chỉnh (apiKey, apiBaseUrl, maxRetries, retryDelayMs)
 * @returns {Promise<boolean>} Trả về true nếu đồng bộ thành công
 */
export async function syncBusinessModel(symbol, data, customOptions = {}) {
  const apiKey = customOptions.apiKey || process.env.API_KEY || 'Luahoachungkhoan@ssi';
  const apiBaseUrl = customOptions.apiBaseUrl || process.env.API_BASE_URL || 'https://stock-api-worker.luahoateam.workers.dev/api';
  const maxRetries = customOptions.maxRetries ?? 3;
  const retryDelayMs = customOptions.retryDelayMs ?? 1000;

  const url = `${apiBaseUrl}/companies/${symbol}/business-model`;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.status === 200) {
        return true;
      }

      // Nếu lỗi Client (4xx) thì ném lỗi ngay lập tức mà không retry
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text();
        throw new Error(`Client error ${response.status}: ${errorText}`);
      }

      // Nếu lỗi Server (5xx), ghi nhận lỗi và chuẩn bị retry
      const errorText = await response.text();
      lastError = new Error(`Server error ${response.status}: ${errorText}`);

    } catch (error) {
      lastError = error;
    }

    // Nếu không phải lần thử cuối cùng, đợi trước khi thử lại
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Failed to sync business model for ${symbol} after ${maxRetries} attempts. Last error: ${lastError.message}`);
}
