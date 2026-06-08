import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import { GlobalResearchEndpoint } from '../endpoints/GlobalResearchEndpoint';

type Env = {
  DB: D1Database;
};

const researchApp = new Hono<{ Bindings: Env }>();
const researchRouter = fromHono(researchApp, {
  docs_url: null,
  redoc_url: null,
  openapi_url: null,
});

researchRouter.get('/', GlobalResearchEndpoint);

export default researchRouter;
