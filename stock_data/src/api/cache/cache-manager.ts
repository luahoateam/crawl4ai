export class CacheManager {
  /**
   * Chuẩn hóa URL bằng cách sắp xếp các query parameters theo thứ tự bảng chữ cái.
   * Điều này giúp tăng tỷ lệ hit cache khi các client truyền tham số với thứ tự khác nhau.
   */
  static normalizeUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      if (!url.search) {
        return urlStr;
      }
      
      const params = new URLSearchParams(url.search);
      const sortedParams = new URLSearchParams();
      
      // Sắp xếp các keys theo bảng chữ cái
      const sortedKeys = Array.from(params.keys()).sort();
      for (const key of sortedKeys) {
        const values = params.getAll(key).sort();
        for (const val of values) {
          sortedParams.append(key, val);
        }
      }
      
      url.search = sortedParams.toString();
      return url.toString();
    } catch (e) {
      return urlStr;
    }
  }

  /**
   * Truy vấn dữ liệu từ cache.
   * Trả về Response chứa header X-Cache-Status: HIT nếu tìm thấy trong cache.
   */
  static async get(request: Request): Promise<Response | null> {
    try {
      const normalizedUrl = this.normalizeUrl(request.url);
      const cache = caches.default;
      
      const cachedResponse = await cache.match(new Request(normalizedUrl, {
        method: request.method,
        headers: request.headers,
      }));
      
      if (!cachedResponse) {
        return null;
      }
      
      // Tạo một Response mới clone từ cachedResponse để có thể ghi đè/thêm headers
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache-Status', 'HIT');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    } catch (e) {
      console.error('CacheManager.get error:', e);
      return null;
    }
  }

  /**
   * Lưu Response thành công vào cache với TTL cụ thể.
   * Đặt header Cache-Control: max-age={ttlSeconds} và X-Cache-Status: MISS.
   */
  static async put(request: Request, response: Response, ttlSeconds = 300): Promise<void> {
    // Chỉ lưu các response thành công 200 OK
    if (response.status !== 200) {
      return;
    }
    
    try {
      const normalizedUrl = this.normalizeUrl(request.url);
      const cache = caches.default;
      
      // Nhân bản headers và đè cấu hình Cache-Control cùng header X-Cache-Status: MISS
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      headers.set('X-Cache-Status', 'MISS');
      
      const responseToCache = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      
      await cache.put(
        new Request(normalizedUrl, {
          method: request.method,
          headers: request.headers,
        }),
        responseToCache
      );
    } catch (e) {
      console.error('CacheManager.put error:', e);
    }
  }
}
