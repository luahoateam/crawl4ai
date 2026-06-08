import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fromHono } from 'chanfana';
import { StatsEndpoint } from './endpoints/StatsEndpoint';
import companyRouter from './routes/company';
import newsRouter from './routes/news';
import documentRouter from './routes/document';
import researchRouter from './routes/research';
import pipelineRouter from './routes/pipeline';

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

  if (['POST', 'PUT', 'DELETE'].includes(method) && !path.startsWith('/api/pipeline/')) {
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

// Mount Sub-routers
openapi.route('/api/companies', companyRouter);
openapi.route('/api/news', newsRouter);
openapi.route('/api/documents', documentRouter);
openapi.route('/api/research', researchRouter);
openapi.route('/api/pipeline', pipelineRouter);

export default app;
