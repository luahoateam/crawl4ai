import type { Company } from './api';
import { removeVietnameseTones } from './search';

export interface FilterOptions {
  exchange: string;
  industry: string;
  searchQuery: string;
}

export function filterCompaniesAdvanced(options: FilterOptions, companies: Company[]): Company[] {
  const { exchange, industry, searchQuery } = options;
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const normalizedSearch = removeVietnameseTones(trimmedSearch);

  return companies.filter(company => {
    // 1. Exchange Filter
    if (exchange !== 'all' && company.exchange.toLowerCase() !== exchange.toLowerCase()) {
      return false;
    }

    // 2. Industry Filter
    if (industry !== 'all' && company.industry !== industry) {
      return false;
    }

    // 3. Search Query Filter
    if (trimmedSearch) {
      const symbolMatch = company.symbol.toLowerCase().includes(trimmedSearch);
      const nameMatch = company.name.toLowerCase().includes(trimmedSearch);
      
      const normalizedSymbol = removeVietnameseTones(company.symbol);
      const normalizedName = removeVietnameseTones(company.name);
      const normalizedMatch = normalizedSymbol.includes(normalizedSearch) || normalizedName.includes(normalizedSearch);

      if (!symbolMatch && !nameMatch && !normalizedMatch) {
        return false;
      }
    }

    return true;
  });
}
