export async function onRequestGet(context) {
  const { env } = context;

  try {
    const list = await env.JOURNAL_BUCKET.list({ prefix: "journal/" });
    const keys = list.objects.map(obj => obj.key);

    return new Response(JSON.stringify(keys), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
