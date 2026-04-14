export async function GET() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
    const data = await res.json();
    const entry = data.data?.[0];
    if (!entry) return Response.json({ value: null });
    return Response.json({
      value: parseInt(entry.value),
      classification: entry.value_classification,
    });
  } catch (e) {
    return Response.json({ value: null, error: e.message });
  }
}
