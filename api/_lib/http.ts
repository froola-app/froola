import type { IncomingMessage, ServerResponse } from 'http';

// Minimal shape Vercel's Node.js runtime actually provides at runtime (it
// parses JSON bodies into req.body itself, and adds res.status/res.json);
// typed locally instead of depending on @vercel/node, which drags in a
// large, vulnerable transitive build-tooling tree for a dev-only type
// import.
export interface ApiRequest extends IncomingMessage {
  body: unknown;
}

export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

export function originFrom(req: ApiRequest): string {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  return `https://${Array.isArray(host) ? host[0] : host}`;
}

// Stripe signature verification needs the exact raw request bytes, so the
// webhook handler disables Vercel's automatic JSON body parsing (`export
// const config = { api: { bodyParser: false } }`) and reads the stream
// itself via this helper.
export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
