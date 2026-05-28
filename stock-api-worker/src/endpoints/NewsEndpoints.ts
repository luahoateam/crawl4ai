import { OpenAPIRoute, contentJson, NotFoundException, UnauthorizedException, ApiException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

/**
 * Schema cho một bài báo lẻ
 */
const NewsItemSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  title: z.string(),
  sourceUrl: z.string().nullable().optional(),
  publishedDate: z.string().nullable().optional(), // ISO String cho API
  r2Key: z.string(),
  createdAt: z.string(),
});

const NewsContentSchema = NewsItemSchema.extend({
  content: z.string().describe('Full markdown content of this specific article'),
});

const NewsCreateSchema = z.object({
  title: z.string().min(3).describe('Article title'),
  content: z.string().min(10).describe('Markdown content'),
  sourceUrl: z.string().url().optional().nullable(),
  publishedDate: z.union([z.string(), z.number()]).optional().nullable().describe('ISO Date or Timestamp'),
});

/**
 * GET /api/companies/:symbol/news
 * Liệt kê các bài báo lẻ của doanh nghiệp (Phân trang và Metadata đầy đủ)
 */
export class ListNews extends OpenAPIRoute {
  schema = {
    tags: ['News'],
    summary: 'List granular news articles for a company',
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()),
      }),
    },
    responses: {
      '200': {
        description: 'Successful list',
        ...contentJson(z.object({ 
          success: z.boolean(), 
          result: z.array(NewsItemSchema) 
        })),
      },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { symbol } = data.params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    const results = await sql`
      SELECT * FROM news_index 
      WHERE symbol = ${symbol} 
      ORDER BY published_date DESC, created_at DESC
    `.all();
    
    return {
      success: true,
      result: results.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        title: item.title,
        sourceUrl: item.source_url,
        publishedDate: item.published_date ? new Date(item.published_date).toISOString() : null,
        r2Key: item.r2_key,
        createdAt: new Date(item.created_at).toISOString(),
      })),
    };
  }
}

/**
 * POST /api/companies/:symbol/news
 * Tạo một bản ghi tin tức lẻ (Granular)
 */
export class CreateNews extends OpenAPIRoute {
  schema = {
    tags: ['News'],
    summary: 'Upload and Index a single news article',
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()),
      }),
      body: contentJson(NewsCreateSchema),
    },
    responses: {
      '200': {
        description: 'Article created successfully',
        ...contentJson(z.object({ success: z.boolean(), result: NewsItemSchema })),
      },
      ...UnauthorizedException.schema(),
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { symbol } = data.params;
    const body = data.body;
    const now = Date.now();
    
    // Chuẩn hóa ngày xuất bản
    let pubDate: number | null = null;
    if (body.publishedDate) {
        pubDate = typeof body.publishedDate === 'string' ? new Date(body.publishedDate).getTime() : body.publishedDate;
    }

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    // 1. Tạo Key duy nhất cho bài báo lẻ trên R2
    const safeTitle = body.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const r2Key = `content/${symbol}/articles/${safeTitle}_${Date.now()}.md`;

    // 2. Lưu vào R2
    await c.env.BUCKET.put(r2Key, body.content);

    // 3. Lưu vào D1 với các trường Metadata mới
    await sql`
      INSERT INTO news_index (symbol, title, source_url, published_date, r2_key, created_at) 
      VALUES (${symbol}, ${body.title}, ${body.sourceUrl ?? null}, ${pubDate}, ${r2Key}, ${now})
    `.execute();

    const inserted = await sql`SELECT * FROM news_index WHERE r2_key = ${r2Key} LIMIT 1`.all();
    const item = inserted[0];

    return {
      success: true,
      result: {
        id: item.id,
        symbol: item.symbol,
        title: item.title,
        sourceUrl: item.source_url,
        publishedDate: item.published_date ? new Date(item.published_date).toISOString() : null,
        r2Key: item.r2_key,
        createdAt: new Date(item.created_at).toISOString(),
      },
    };
  }
}

/**
 * GET /api/news/:id
 * Lấy nội dung chi tiết bài báo lẻ
 */
export class GetNewsDetail extends OpenAPIRoute {
  schema = {
    tags: ['News'],
    summary: 'Get granular news content from R2',
    request: {
      params: z.object({
        id: z.coerce.number(),
      }),
    },
    responses: {
      '200': {
        description: 'Full news content',
        ...contentJson(z.object({ success: z.boolean(), result: NewsContentSchema })),
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(c: any) {
    const { id } = (await this.getValidatedData<typeof this.schema>()).params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    const results = await sql`SELECT * FROM news_index WHERE id = ${id} LIMIT 1`.all();
    if (results.length === 0) throw new NotFoundException('News article not found');

    const item = results[0];
    const object = await c.env.BUCKET.get(item.r2_key);
    const content = object ? await object.text() : "Content not found in R2 storage";

    return {
      success: true,
      result: {
        id: item.id,
        symbol: item.symbol,
        title: item.title,
        sourceUrl: item.source_url,
        publishedDate: item.published_date ? new Date(item.published_date).toISOString() : null,
        r2Key: item.r2_key,
        content,
        createdAt: new Date(item.created_at).toISOString(),
      },
    };
  }
}

/**
 * DELETE /api/news/:id
 */
export class DeleteNews extends OpenAPIRoute {
  schema = {
    tags: ['News'],
    summary: 'Delete a news article and its R2 content',
    request: {
      params: z.object({
        id: z.coerce.number(),
      }),
    },
    responses: {
      '200': {
        description: 'Deleted',
        ...contentJson(z.object({ success: z.boolean() })),
      },
      ...UnauthorizedException.schema(),
    },
  };

  async handle(c: any) {
    const { id } = (await this.getValidatedData<typeof this.schema>()).params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    const results = await sql`SELECT r2_key FROM news_index WHERE id = ${id} LIMIT 1`.all();
    if (results.length > 0) {
      await c.env.BUCKET.delete(results[0].r2_key);
      await sql`DELETE FROM news_index WHERE id = ${id}`.execute();
    }

    return { success: true };
  }
}
