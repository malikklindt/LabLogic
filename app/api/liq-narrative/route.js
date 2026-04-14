import { readFileSync } from 'fs';
import { join } from 'path';

function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch { return null; }
}

export async function POST(request) {
  const { total_usd, longs_usd, shorts_usd, recent } = await request.json();
  const apiKey = getAnthropicKey();
  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 });

  const longPct  = total_usd > 0 ? ((longs_usd / total_usd) * 100).toFixed(0) : 50;
  const shortPct = total_usd > 0 ? ((shorts_usd / total_usd) * 100).toFixed(0) : 50;

  const recentSummary = (recent ?? [])
    .slice(0, 5)
    .map(r => `${r.symbol} ${r.side} liq $${(r.amount_usd / 1e6).toFixed(2)}M on ${r.exchange}`)
    .join(', ');

  const prompt = `You are a sharp crypto market analyst. In exactly 2-3 sentences, tell a concise story about what these liquidation numbers mean for the market right now. Be direct, opinionated, and specific. No fluff.

Data:
- Total liquidated (24H): $${(total_usd / 1e6).toFixed(1)}M
- Longs wiped: $${(longs_usd / 1e6).toFixed(1)}M (${longPct}%)
- Shorts wiped: $${(shorts_usd / 1e6).toFixed(1)}M (${shortPct}%)
- Recent large liquidations: ${recentSummary || 'none'}

Give the narrative:`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 180,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status });
    }

    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
