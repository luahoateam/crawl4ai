import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import { IngestAnnualReport, UpdateAnnualReportStatus, GetPendingAnnualReports, GetDailyQuota } from '../endpoints/AnnualReportEndpoints';

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const pipelineApp = new Hono<{ Bindings: Env }>();
const pipelineRouter = fromHono(pipelineApp, {
  docs_url: null,
  redoc_url: null,
  openapi_url: null,
});

pipelineRouter.post('/annual-reports/ingest', IngestAnnualReport);
pipelineRouter.post('/annual-reports/update-status', UpdateAnnualReportStatus);
pipelineRouter.get('/annual-reports/pending', GetPendingAnnualReports);
pipelineRouter.get('/annual-reports/quota', GetDailyQuota);

export default pipelineRouter;
