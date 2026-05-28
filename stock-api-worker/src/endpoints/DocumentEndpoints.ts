import { OpenAPIRoute, contentJson, NotFoundException, UnauthorizedException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';
import { FinancialOcrPreprocessor } from '../utils/preprocessor';

const DocumentSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  year: z.number(),
  fileName: z.string(),
  fileUrl: z.string(),
  r2Key: z.string(),
  label: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  createdAt: z.string(),
});

/**
 * GET /api/documents/:id/view
 * Trả về nội dung văn bản thô từ R2 để hiển thị trên trình duyệt.
 */
export class ViewDocumentContent extends OpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'View raw OCR content from R2',
    request: {
      params: z.object({
        id: z.coerce.number().describe('Document ID'),
      }),
    },
    responses: {
      '200': {
        description: 'Document content',
        content: {
          'text/plain': {
            schema: { type: 'string' }
          }
        }
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(c: any) {
    const { id } = (await this.getValidatedData<typeof this.schema>()).params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    const results = await sql`SELECT r2_key FROM financial_documents WHERE id = ${id} LIMIT 1`.all();
    if (results.length === 0) throw new NotFoundException('Document not found');

    const item = results[0];
    const object = await c.env.BUCKET.get(item.r2_key);
    
    if (!object) return c.text('File not found in storage', 404);

    const content = await object.text();
    return c.text(content, 200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
  }
}

/**
 * POST /api/companies/:symbol/documents
 * Nạp Metadata và File Content (OCR) vào hệ thống.
 */
export class CreateDocument extends OpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'Upload OCR document metadata and content',
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()),
      }),
      body: contentJson(z.object({
        year: z.number(),
        fileName: z.string(),
        content: z.string(),
        label: z.string().optional(),
      })),
    },
    responses: {
      '200': {
        description: 'Created',
        ...contentJson(z.object({ success: z.boolean(), result: DocumentSchema })),
      },
      ...UnauthorizedException.schema(),
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { symbol } = data.params;
    const body = data.body;
    const now = Date.now();
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    // 1. Lưu song song vào R2: bản gốc (raw) và bản đã tiền xử lý (preprocessed)
    const rawKey = `documents/${symbol}/${body.year}/raw_${body.fileName}`;
    const preprocessedKey = `documents/${symbol}/${body.year}/${body.fileName}`;
    
    // Lưu bản gốc
    await c.env.BUCKET.put(rawKey, body.content);
    
    // Làm sạch và lưu bản preprocessed
    const preprocessedContent = FinancialOcrPreprocessor.process(body.content);
    await c.env.BUCKET.put(preprocessedKey, preprocessedContent);

    // 2. Ghi vào D1 với logic INSERT OR REPLACE trỏ r2_key tới preprocessedKey
    await sql`
      INSERT OR REPLACE INTO financial_documents (symbol, year, file_name, file_url, r2_key, label, created_at)
      VALUES (${symbol}, ${body.year}, ${body.fileName}, '', ${preprocessedKey}, ${body.label ?? null}, ${now})
    `.execute();

    const inserted = await sql`SELECT * FROM financial_documents WHERE r2_key = ${preprocessedKey} LIMIT 1`.all();
    const id = inserted[0].id;
    
    // 3. Tự động sinh fileUrl chính xác và cập nhật
    const fileUrl = `${new URL(c.req.url).origin}/api/documents/${id}/view`;
    await sql`UPDATE financial_documents SET file_url = ${fileUrl} WHERE id = ${id}`.execute();

    return {
      success: true,
      result: {
        id: inserted[0].id,
        symbol: inserted[0].symbol,
        year: inserted[0].year,
        fileName: inserted[0].file_name,
        fileUrl,
        r2Key: inserted[0].r2_key,
        label: inserted[0].label,
        status: inserted[0].status,
        createdAt: new Date(inserted[0].created_at).toISOString(),
      },
    };
  }
}
