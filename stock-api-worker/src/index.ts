import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fromHono } from 'chanfana';
import { CompanyPackEndpoint } from './endpoints/CompanyPackEndpoint';
import { ListCompanies, CreateCompany, DeleteCompany } from './endpoints/CompanyEndpoints';
import { GetBusinessModel, UpdateBusinessModel, DeleteBusinessModel } from './endpoints/BusinessModelEndpoints';
import { GetDailyResearch, UpdateDailyResearch, DeleteDailyResearch } from './endpoints/DailyResearchEndpoints';
import { ListNews, CreateNews, GetNewsDetail, DeleteNews } from './endpoints/NewsEndpoints';
import { ViewDocumentContent, CreateDocument } from './endpoints/DocumentEndpoints';
import { StatsEndpoint } from './endpoints/StatsEndpoint';
import { GlobalNewsEndpoint } from './endpoints/GlobalNewsEndpoint';
import { GlobalDocumentsEndpoint } from './endpoints/GlobalDocumentsEndpoint';
import { GlobalResearchEndpoint } from './endpoints/GlobalResearchEndpoint';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend clients
app.use('/api/*', cors());

/**
 * Middleware: Security Check
 */
app.use('/api/*', async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;

  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const apiKey = c.req.header('X-API-Key');
    const expectedKey = c.env.API_KEY || 'Luahoachungkhoan@ssi';
    
    if (apiKey !== expectedKey) {
      return c.json({ success: false, error: 'Unauthorized: Missing or invalid API Key' }, 401);
    }
    c.header('Cache-Control', 'no-store');
  }

  if (method === 'GET') {
    if (path.startsWith('/api/stats')) {
      c.header('Cache-Control', 'public, max-age=3600');
    } else if (path.startsWith('/api/companies') && path.endsWith('/pack')) {
      c.header('Cache-Control', 'public, max-age=21600');
    } else if (path.startsWith('/api/companies')) {
      c.header('Cache-Control', 'public, max-age=21600');
    } else if (path.startsWith('/api/news')) {
      c.header('Cache-Control', 'public, max-age=300');
    } else if (path.startsWith('/api/documents')) {
      c.header('Cache-Control', 'public, max-age=1800');
    } else if (path.startsWith('/api/research')) {
      c.header('Cache-Control', 'public, max-age=3600');
    }
  }

  await next();
});

app.get('/smoke', (c) => {
  return c.json({ db: !!c.env.DB, bucket: !!c.env.BUCKET });
});

/**
 * Chanfana OpenAPI Configuration
 */
const openapi = fromHono(app, {
  docs_url: '/docs',
  openapi_url: '/openapi.json',
  spec: {
    info: {
      title: 'Vietnam Stock Data Hub API',
      version: '1.2.0',
      description: 'Full CRUD API for Companies, Business Models, Research, News, and OCR Documents.',
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
});

/**
 * API Routes Registration
 */

// Stats
openapi.get('/api/stats', StatsEndpoint);

// Companies Profile
openapi.get('/api/companies', ListCompanies);
openapi.post('/api/companies', CreateCompany);
openapi.delete('/api/companies/:symbol', DeleteCompany);

// Business Model
openapi.get('/api/companies/:symbol/business-model', GetBusinessModel);
openapi.put('/api/companies/:symbol/business-model', UpdateBusinessModel);
openapi.delete('/api/companies/:symbol/business-model', DeleteBusinessModel);

// Daily Research
openapi.get('/api/research', GlobalResearchEndpoint);
openapi.get('/api/companies/:symbol/research', GetDailyResearch);
openapi.put('/api/companies/:symbol/research', UpdateDailyResearch);
openapi.delete('/api/companies/:symbol/research', DeleteDailyResearch);

// News
openapi.get('/api/news', GlobalNewsEndpoint);
openapi.get('/api/companies/:symbol/news', ListNews);
openapi.post('/api/companies/:symbol/news', CreateNews);
openapi.get('/api/news/:id', GetNewsDetail);
openapi.delete('/api/news/:id', DeleteNews);

// OCR Documents
openapi.get('/api/documents', GlobalDocumentsEndpoint);
openapi.post('/api/companies/:symbol/documents', CreateDocument);
openapi.get('/api/documents/:id/view', ViewDocumentContent);

// Consolidated Pack for AI
openapi.get('/api/companies/:symbol/pack', CompanyPackEndpoint);

export default app;
