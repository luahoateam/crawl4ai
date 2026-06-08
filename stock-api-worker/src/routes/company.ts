import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import { CompanyPackEndpoint } from '../endpoints/CompanyPackEndpoint';
import { ListCompanies, CreateCompany, DeleteCompany, GetCompanyProfile } from '../endpoints/CompanyEndpoints';
import { GetBusinessModel, UpdateBusinessModel, DeleteBusinessModel } from '../endpoints/BusinessModelEndpoints';
import { GetDailyResearch, UpdateDailyResearch, DeleteDailyResearch } from '../endpoints/DailyResearchEndpoints';
import { ListNews, CreateNews } from '../endpoints/NewsEndpoints';
import { CreateDocument } from '../endpoints/DocumentEndpoints';
import { GetAnnualReportStatus } from '../endpoints/AnnualReportEndpoints';
import {
  GetFinancialInsights,
  GetDebtsBreakdown,
  GetInventories,
  GetRelatedPartyTransactions,
  GetBankingMetrics,
} from '../endpoints/FinancialMetricsEndpoints';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const companyApp = new Hono<{ Bindings: Env }>();
const companyRouter = fromHono(companyApp, {
  docs_url: null,
  redoc_url: null,
  openapi_url: null,
});

// Profile
companyRouter.get('/', ListCompanies);
companyRouter.post('/', CreateCompany);
companyRouter.get('/:symbol', GetCompanyProfile);
companyRouter.delete('/:symbol', DeleteCompany);

// Business Model
companyRouter.get('/:symbol/business-model', GetBusinessModel);
companyRouter.put('/:symbol/business-model', UpdateBusinessModel);
companyRouter.delete('/:symbol/business-model', DeleteBusinessModel);

// Daily Research
companyRouter.get('/:symbol/research', GetDailyResearch);
companyRouter.put('/:symbol/research', UpdateDailyResearch);
companyRouter.delete('/:symbol/research', DeleteDailyResearch);

// News
companyRouter.get('/:symbol/news', ListNews);
companyRouter.post('/:symbol/news', CreateNews);

// Documents
companyRouter.post('/:symbol/documents', CreateDocument);
companyRouter.get('/:symbol/annual-reports', GetAnnualReportStatus);

// Financial Metrics
companyRouter.get('/:symbol/financial-insights', GetFinancialInsights);
companyRouter.get('/:symbol/debts-breakdown', GetDebtsBreakdown);
companyRouter.get('/:symbol/inventories', GetInventories);
companyRouter.get('/:symbol/related-party-transactions', GetRelatedPartyTransactions);
companyRouter.get('/:symbol/banking-metrics', GetBankingMetrics);

// Consolidated Pack
companyRouter.get('/:symbol/pack', CompanyPackEndpoint);

export default companyRouter;

