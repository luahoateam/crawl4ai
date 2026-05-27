import { describe, it, expect } from 'vitest';
import { validateCompanyPack } from './pack';

describe('Company Pack Validator', () => {
  it('should validate complete company pack correctly', () => {
    const validPack = {
      company: { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép' },
      businessModel: {
        revenueStruct: [{ item: 'Thép xây dựng', value: 80 }],
        profitStruct: [{ item: 'Thép xây dựng', value: 75 }],
        inputs: [{ item: 'Quặng sắt', value: 50 }],
        production: [{ item: 'Luyện kim', value: 100 }],
        outputs: [{ item: 'Thép thành phẩm', value: 100 }]
      },
      news: [],
      documents: []
    };

    expect(validateCompanyPack(validPack)).toBe(true);
  });

  it('should reject pack missing company details', () => {
    const invalidPack = {
      businessModel: {
        inputs: [],
        production: [],
        outputs: []
      }
    };

    expect(validateCompanyPack(invalidPack)).toBe(false);
  });

  it('should reject pack missing key business model arrays', () => {
    const invalidPack = {
      company: { symbol: 'HPG', name: 'Tập đoàn Hòa Phát' },
      businessModel: {
        inputs: []
      }
    };

    expect(validateCompanyPack(invalidPack)).toBe(false);
  });
});
