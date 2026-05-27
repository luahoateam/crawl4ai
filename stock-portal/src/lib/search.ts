import type { Company } from './api';

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

export function filterCompanies(query: string, companies: Company[]): Company[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const normalizedQuery = removeVietnameseTones(trimmed);

  const filtered = companies.filter(company => {
    const symbolMatch = company.symbol.toLowerCase().includes(trimmed);
    const nameMatch = company.name.toLowerCase().includes(trimmed);
    
    const normalizedSymbol = removeVietnameseTones(company.symbol);
    const normalizedName = removeVietnameseTones(company.name);
    
    const normalizedMatch = normalizedSymbol.includes(normalizedQuery) || normalizedName.includes(normalizedQuery);

    return symbolMatch || nameMatch || normalizedMatch;
  });

  return filtered.slice(0, 8);
}
