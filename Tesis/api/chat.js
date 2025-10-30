// api/chat.js
export const runtime = 'edge';
import { POST as AskPOST } from './ask/route.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('question') || 'Hola').slice(0, 2000);
  const body = { messages: [{ role: 'user', content: q }], products: [] };
  return AskPOST(new Request(req.url, { method: 'POST', body: JSON.stringify(body) }));
}

export async function POST(req) {
  // Simplemente reusa el handler de /api/ask
  return AskPOST(req);
}
