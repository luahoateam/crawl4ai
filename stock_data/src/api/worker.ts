import { handleStockRequest } from './handlers/stock';

export default {
  async fetch(
    request: Request,
    env: { DB: any },
    ctx: { waitUntil: (promise: Promise<any>) => void }
  ): Promise<Response> {
    const url = new URL(request.url);

    // Chỉ chấp nhận các đường dẫn chính xác cho API tối ưu hóa
    if (url.pathname === '/api/v1/stock') {
      if (request.method !== 'GET') {
        return Response.json(
          { error: 'Method Not Allowed. Only GET is supported.' },
          { status: 405 }
        );
      }
      return handleStockRequest(request, env, ctx);
    }

    // Trả về lỗi 404 cho các route không xác định
    return Response.json(
      { error: 'Not Found' },
      { status: 404 }
    );
  },
};
