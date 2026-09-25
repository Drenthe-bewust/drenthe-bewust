// "Nu online zetten"-knop in het beheerpaneel → start een Netlify-build via een build hook.
// Alleen voor ingelogde beheerders (Netlify Identity-token wordt door Netlify gecontroleerd).
//
// Vereiste omgevingsvariabele (Netlify > Site settings > Environment):
//   NETLIFY_BUILD_HOOK — URL van een build hook (Site settings > Build & deploy > Build hooks)

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const gebruiker = context.clientContext && context.clientContext.user;
  if (!gebruiker) {
    return { statusCode: 401, body: 'Niet ingelogd' };
  }

  const hook = process.env.NETLIFY_BUILD_HOOK;
  if (!hook) {
    return { statusCode: 500, body: 'NETLIFY_BUILD_HOOK is niet ingesteld' };
  }

  const res = await fetch(hook, { method: 'POST', body: '{}' });
  if (!res.ok) {
    return { statusCode: 502, body: `Build hook gaf ${res.status}` };
  }

  console.log(`Build gestart door ${gebruiker.email}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
