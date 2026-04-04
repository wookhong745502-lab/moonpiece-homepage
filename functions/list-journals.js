export async function onRequestGet(context) {
  const { env } = context;
  const listFile = "journals.json";

  try {
    const existing = await env.JOURNAL_BUCKET.get(listFile);
    if (!existing) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const journals = await existing.json();
    return new Response(JSON.stringify(journals), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
