export interface Company {
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  logoUrl?: string;
  description?: string;
}

export interface BusinessModel {
  revenueStruct?: any[];
  profitStruct?: any[];
  inputs?: any[];
  production?: any[];
  outputs?: any[];
}

export interface NewsItem {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}

export interface FinancialDocument {
  id: number;
  title: string;
  url: string;
  type: string;
  publishedAt: string;
}

export interface DailyResearchItem {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export interface CompanyPack {
  company: Company;
  businessModel: BusinessModel;
  news: NewsItem[];
  documents: FinancialDocument[];
  dailyResearch: DailyResearchItem[];
}

const getApiBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.API_URL) {
    return process.env.API_URL;
  }
  // @ts-ignore
  if (import.meta.env && import.meta.env.API_URL) {
    // @ts-ignore
    return import.meta.env.API_URL;
  }
  return 'http://localhost:8787';
};

export async function fetchCompanies(): Promise<Company[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/companies`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch companies: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchCompanyPack(symbol: string): Promise<CompanyPack> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/companies/${symbol.toUpperCase()}/pack`);
  
  if (response.status === 404) {
    throw new Error(`Company not found: ${symbol}`);
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch company pack: ${response.statusText}`);
  }
  
  return response.json();
}
