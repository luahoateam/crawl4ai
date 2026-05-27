import type { APIRoute } from 'astro';
import { signJWT } from '../../../lib/jwt';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Vui lòng điền đầy đủ thông tin' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let isValid = false;
    let userId = '';

    const expectedUsername = 'luahoateam';
    const passwordHash = await sha256(password);
    
    if (username === expectedUsername && passwordHash === 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f') {
      isValid = true;
      userId = 'luahoa-member-1';
    }

    // @ts-ignore
    const userStore = locals.runtime?.env?.USER_STORE || globalThis.USER_STORE;
    if (userStore) {
      try {
        const storedUserJson = await userStore.get(`user:${username}`);
        if (storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          const inputHash = await sha256(password);
          if (storedUser.passwordHash === inputHash) {
            isValid = true;
            userId = storedUser.id || username;
          }
        }
      } catch (kvErr) {
        console.error('KV Error:', kvErr);
      }
    }

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // @ts-ignore
    const jwtSecret = locals.runtime?.env?.JWT_SECRET || process.env.JWT_SECRET || 'lua-hoa-secret-key-super-secure-2026';
    const token = await signJWT({ userId, username, role: 'member' }, jwtSecret);

    cookies.set('token', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
