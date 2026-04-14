export function timeSince(ms) {
  if (!ms) return null;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Strip markdown formatting characters from AI output
function stripMd(text) {
  return text
    .replace(/\*\*/g, '')   // bold
    .replace(/\*/g, '')      // italic / bullet
    .replace(/^#{1,6}\s/gm, '') // headings
    .replace(/`/g, '')       // code
    .replace(/__/g, '')      // underline
    .replace(/~~[^~]*~~/g, s => s.slice(2, -2)); // strikethrough
}

const MD_SUFFIX = 'Never use markdown formatting. No asterisks, no bold, no bullet points, no headers. Plain sentences only.';

export async function streamAI({ system, messages, max_tokens = 200 }, onChunk, onDone, onError) {
  try {
    const res = await fetch('/api/ai-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens,
        system: system ? `${system} ${MD_SUFFIX}` : MD_SUFFIX,
        messages,
      }),
    });
    if (!res.ok) { onError(new Error(`API ${res.status}`)); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') continue;
        try {
          const evt = JSON.parse(json);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            onChunk(stripMd(evt.delta.text));
          }
        } catch (_) {}
      }
    }
    onDone();
  } catch (e) { onError(e); }
}
