import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import { GlobalDocumentsEndpoint } from '../endpoints/GlobalDocumentsEndpoint';
import { ViewDocumentContent } from '../endpoints/DocumentEndpoints';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const documentApp = new Hono<{ Bindings: Env }>();
const documentRouter = fromHono(documentApp, {
  docs_url: null,
  redoc_url: null,
  openapi_url: null,
});

documentRouter.get('/', GlobalDocumentsEndpoint);
documentRouter.get('/:id/view', ViewDocumentContent);

export default documentRouter;
