import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import { GlobalNewsEndpoint } from '../endpoints/GlobalNewsEndpoint';
import { GetNewsDetail, DeleteNews } from '../endpoints/NewsEndpoints';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const newsApp = new Hono<{ Bindings: Env }>();
const newsRouter = fromHono(newsApp, {
  docs_url: null,
  redoc_url: null,
  openapi_url: null,
});

newsRouter.get('/', GlobalNewsEndpoint);
newsRouter.get('/:id', GetNewsDetail);
newsRouter.delete('/:id', DeleteNews);

export default newsRouter;
