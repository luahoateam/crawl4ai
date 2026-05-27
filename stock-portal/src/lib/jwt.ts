function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function signJWT(payload: any, secret: string, expiresInSeconds = 7 * 24 * 60 * 60): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = arrayBufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = arrayBufferToBase64Url(encoder.encode(JSON.stringify(fullPayload)));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(signatureInput)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);
  return `${signatureInput}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBuffer = base64UrlToArrayBuffer(encodedSignature);

  const isValid = await crypto.subtle.verify(
    'HMAC',
    secretKey,
    signatureBuffer,
    encoder.encode(signatureInput)
  );

  if (!isValid) {
    throw new Error('JWT signature verification failed');
  }

  const payloadStr = new TextDecoder().decode(base64UrlToArrayBuffer(encodedPayload));
  const payload = JSON.parse(payloadStr);

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error('JWT token expired');
  }

  return payload;
}
