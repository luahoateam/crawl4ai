import { env } from 'cloudflare:workers';
export interface Company {
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  logoUrl?: string;
  description?: string;
  hasBusinessModel?: boolean;
  hasResearch?: boolean;
  newsCount?: number;
  docCount?: number;
}

export interface BusinessModel {
  revenueStruct?: any[];
  profitStruct?: any[];
  inputs?: any[];
  production?: any[];
  outputs?: any[];
  others?: string | null;
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
  ssiReview?: string | null;
}

export interface CompanyPack {
  company: Company;
  businessModel: BusinessModel;
  news: NewsItem[];
  documents: FinancialDocument[];
  dailyResearch: DailyResearchItem[];
}

const getApiBaseUrl = (): string => {
  // @ts-ignore
  if (import.meta.env.PUBLIC_API_URL) {
    // @ts-ignore
    return import.meta.env.PUBLIC_API_URL;
  }
  return 'http://localhost:8787';
};

const safeFetch = async (url: string, init?: any): Promise<Response> => {
  try {
    // @ts-ignore
    const apiWorker = env.API_WORKER;
    if (apiWorker) {
      // Direct call on Service Binding with original URL is fully supported by Cloudflare Fetcher
      const response = await apiWorker.fetch(url, init);
      if (response) return response;
    }
  } catch (e: any) {
    console.error('Service Binding fetch failed, falling back to global fetch:', e);
    // @ts-ignore
    globalThis.SB_FETCH_ERROR = { message: e.message, stack: e.stack };
  }
  return fetch(url, init);
};

const COMPANY_NAMES: Record<string, string> = {
  'HPG': 'Tập đoàn Hòa Phát',
  'HSG': 'Tập đoàn Hoa Sen',
  'NKG': 'Thép Nam Kim',
  'VCB': 'Ngân hàng Vietcombank',
  'ACB': 'Ngân hàng ACB',
  'BID': 'Ngân hàng BIDV',
  'CTG': 'VietinBank',
  'MBB': 'Ngân hàng Quân Đội',
  'VND': 'Chứng khoán VNDirect',
  'SSI': 'Chứng khoán SSI',
  'VCI': 'Chứng khoán Vietcap',
  'FPT': 'Tập đoàn FPT',
  'MWG': 'Thế Giới Di Động',
  'PNJ': 'Vàng bạc Phú Nhuận',
  'VNM': 'Vinamilk',
  'VIC': 'Tập đoàn Vingroup',
  'VHM': 'Vinhomes'
};

export async function fetchCompanies(): Promise<Company[]> {
  const baseUrl = getApiBaseUrl();
  const response = await safeFetch(`${baseUrl}/api/companies`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch companies: ${response.statusText}`);
  }
  
  const data = await response.json();
  const list = data.result || [];
  return list.map((c: any) => ({
    symbol: c.symbol,
    name: COMPANY_NAMES[c.symbol] || `Doanh nghiệp ${c.symbol}`,
    exchange: c.exchange,
    industry: c.industry,
    hasBusinessModel: c.hasBusinessModel,
    hasResearch: c.hasResearch,
    newsCount: c.newsCount,
    docCount: c.docCount
  }));
}

export async function fetchCompanyPack(symbol: string): Promise<CompanyPack> {
  const baseUrl = getApiBaseUrl();
  const response = await safeFetch(`${baseUrl}/api/companies/${symbol.toUpperCase()}/pack`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (response.status === 404) {
    throw new Error(`Company not found: ${symbol}`);
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch company pack: ${response.statusText}`);
  }
  
  const data = await response.json();
  const result = data.result || data;
  
  if (!result) {
    throw new Error(`API returned empty data for company: ${symbol}`);
  }
  
  const bizModel = result.businessModel || {};
  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(field) ? field : [];
  };
  
  return {
    company: {
      symbol: result.profile.symbol,
      name: COMPANY_NAMES[result.profile.symbol] || `Doanh nghiệp ${result.profile.symbol}`,
      exchange: result.profile.exchange,
      industry: result.profile.industry || 'Chưa phân ngành',
      description: result.profile.description || `Thông tin chi tiết về mô hình kinh doanh và báo cáo nghiên cứu của Doanh nghiệp ${result.profile.symbol}.`
    },
    businessModel: {
      revenueStruct: parseJsonField(bizModel.revenueStruct),
      profitStruct: parseJsonField(bizModel.profitStruct),
      inputs: parseJsonField(bizModel.inputs),
      production: parseJsonField(bizModel.production),
      outputs: parseJsonField(bizModel.outputs),
      others: bizModel.others || null
    },
    news: (result.news || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      url: item.sourceUrl || '#',
      publishedAt: item.createdAt || new Date().toISOString(),
      source: item.source || 'Tin tức hệ thống'
    })),
    documents: (result.documents || []).map((item: any) => ({
      id: item.id,
      title: item.fileName || `Tài liệu tài chính ${item.year}`,
      url: item.fileUrl || '#',
      type: item.label || 'Báo cáo',
      publishedAt: item.createdAt || new Date().toISOString()
    })),
    dailyResearch: result.research ? [
      {
        id: 1,
        title: `Báo cáo phân tích chuyên sâu ${symbol.toUpperCase()}`,
        url: '#',
        publishedAt: result.research.lastUpdated || new Date().toISOString(),
        summary: result.research.summary || 'Thông tin đánh giá chi tiết chưa được cập nhật.',
        ssiReview: result.research.ssiReview || null
      }
    ] : []
  };
}

export interface StatsResult {
  companies: number;
  businessModels: number;
  dailyResearch: number;
  news: number;
  documents: number;
}

export async function fetchStats(): Promise<StatsResult> {
  const baseUrl = getApiBaseUrl();
  const response = await safeFetch(`${baseUrl}/api/stats`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result;
}

export interface GlobalNewsItem {
  id: number;
  symbol: string;
  title: string;
  sourceUrl?: string | null;
  publishedDate?: string | null;
  r2Key: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
}

export interface GlobalNewsResult {
  result: GlobalNewsItem[];
  pagination: Pagination;
}

export async function fetchGlobalNews(params?: { symbol?: string; q?: string; page?: number; perPage?: number }): Promise<GlobalNewsResult> {
  const baseUrl = getApiBaseUrl();
  const queryParams = new URLSearchParams();
  if (params?.symbol) queryParams.set('symbol', params.symbol);
  if (params?.q) queryParams.set('q', params.q);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.perPage) queryParams.set('per_page', String(params.perPage));
  
  const queryString = queryParams.toString();
  const url = `${baseUrl}/api/news${queryString ? `?${queryString}` : ''}`;

  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch global news: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    result: data.result || [],
    pagination: data.pagination
  };
}

export interface GlobalDocItem {
  id: number;
  symbol: string;
  year: number;
  fileName: string;
  fileUrl: string;
  r2Key: string;
  label?: string | null;
  status?: string | null;
  createdAt: string;
}

export interface GlobalDocResult {
  result: GlobalDocItem[];
  pagination: Pagination;
}

export async function fetchGlobalDocuments(params?: { symbol?: string; year?: number; q?: string; page?: number; perPage?: number }): Promise<GlobalDocResult> {
  const baseUrl = getApiBaseUrl();
  const queryParams = new URLSearchParams();
  if (params?.symbol) queryParams.set('symbol', params.symbol);
  if (params?.year) queryParams.set('year', String(params.year));
  if (params?.q) queryParams.set('q', params.q);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.perPage) queryParams.set('per_page', String(params.perPage));
  
  const queryString = queryParams.toString();
  const url = `${baseUrl}/api/documents${queryString ? `?${queryString}` : ''}`;

  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch global documents: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    result: data.result || [],
    pagination: data.pagination
  };
}

export interface GlobalResearchItem {
  symbol: string;
  summary: string | null;
  lastUpdated: string | null;
  exchange: string;
  industry: string | null;
}

export interface GlobalResearchResult {
  result: GlobalResearchItem[];
  pagination: Pagination;
}

export async function fetchGlobalResearch(params?: { symbol?: string; page?: number; perPage?: number }): Promise<GlobalResearchResult> {
  const baseUrl = getApiBaseUrl();
  const queryParams = new URLSearchParams();
  if (params?.symbol) queryParams.set('symbol', params.symbol);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.perPage) queryParams.set('per_page', String(params.perPage));
  
  const queryString = queryParams.toString();
  const url = `${baseUrl}/api/research${queryString ? `?${queryString}` : ''}`;

  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch global research: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    result: data.result || [],
    pagination: data.pagination
  };
}
