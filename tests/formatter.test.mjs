import test from 'node:test';
import assert from 'node:assert';

// Cố gắng import module formatter.mjs (sẽ báo lỗi ở Red Phase vì file chưa tồn tại)
import * as formatter from '../scripts/formatter.mjs';

test('Formatter - cleanString should clean whitespace and newlines', () => {
  const input = "  Doanh thu   mảng   bao bì \n nhựa  đóng góp \n\n 80%   \n";
  const expected = "Doanh thu mảng bao bì nhựa đóng góp 80%";
  
  const result = formatter.cleanString(input);
  assert.strictEqual(result, expected);
});

test('Formatter - formatExtraction should clean extraction fields', () => {
  const rawInput = {
    revenue_struct: "   Doanh thu mảng bao bì nhựa \n đóng góp 80%  ",
    profit_struct: "  Mảng xuất khẩu   đóng đóng góp 70%  "
  };
  
  const expected = {
    revenueStruct: "Doanh thu mảng bao bì nhựa đóng góp 80%",
    profitStruct: "Mảng xuất khẩu đóng đóng góp 70%"
  };
  
  const result = formatter.formatExtraction(rawInput);
  assert.deepStrictEqual(result, expected);
});

test('Formatter - formatExtraction should handle missing fields', () => {
  const rawInput = {
    revenue_struct: "Doanh thu"
  };
  
  const result = formatter.formatExtraction(rawInput);
  assert.strictEqual(result.revenueStruct, "Doanh thu");
  assert.strictEqual(result.profitStruct, null);
});
