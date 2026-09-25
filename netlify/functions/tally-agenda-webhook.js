// Tally webhook → GitHub API → nieuw agenda-item in _agenda/
// Een bewust-maker meldt via het Tally-formulier "Activiteit aanmelden" een activiteit aan.
// Deze functie maakt er een Markdown-bestand van in _agenda/ en commit dat naar GitHub.
//
// Standaard komt de activiteit binnen als concept (gepubliceerd: false): Marcella of Elsemarie
// zetten hem in het beheerpaneel (Agenda) op "Gepubliceerd" na een korte controle.
// Wil je dat aanmeldingen direct online komen? Zet dan AGENDA_DIRECT_PUBLICEREN=true.
//
// Omgevingsvariabelen (Netlify > Site settings > Environment):
//   GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH   — dezelfde als voor tally-webhook.js
//   TALLY_AGENDA_SIGNING_SECRET — (optioneel) handtekeninggeheim van déze Tally-webhook
//   AGENDA_DIRECT_PUBLICEREN    — (optioneel) 'true' = zonder controle publiceren

const https = require('https');
const crypto = require('crypto');
const yaml = require('js-yaml');

// Tally-veldlabel → YAML-sleutel in _agenda/*.md
// (zowel de labels van het formulier in Tally als die uit _scripts/maak-tally-agenda-formulier.js)
const VELDEN = {
  'Naam van de activiteit':       'titel',
  'Vaste datum of doorlopend':    'soort',
  'Soort activiteit':             'soort',
  'Start datum':                  'datum',
  'Datum':                        'datum',
  'Start tijdstip':               'starttijd',
  'Eind tijdstip':                'eindtijd',
  'Tijdstip':                     'tijdstip',
  'Locatie':                      'locatie',
  'Organisator':                  'organisator',
  'Georganiseerd door':           'organisator',
  'Korte beschrijving':           'beschrijving',
  'Link naar de activiteit':      'aanmeld',
  'Link voor aanmelden of info':  'aanmeld',
  'Prijs':                        'prijs',
  'Email adres voor contact':     'contact_email',
  'Jouw e-mailadres':             'contact_email',
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (process.env.TALLY_AGENDA_SIGNING_SECRET) {
    const sig = event.headers['tally-signature'];
    if (!verifySignature(event.body, sig, process.env.TALLY_AGENDA_SIGNING_SECRET)) {
      console.error('Ongeldige Tally-handtekening');
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Ongeldige JSON' };
  }

  const fields = payload?.data?.fields;
  if (!Array.isArray(fields)) {
    return { statusCode: 400, body: 'Geen velden in payload' };
  }

  const invoer = {};
  for (const field of fields) {
    const sleutel = VELDEN[field.label];
    if (sleutel) invoer[sleutel] = tekstwaarde(field);
  }

  if (!invoer.titel) {
    return { statusCode: 400, body: 'Naam van de activiteit ontbreekt' };
  }

  const doorlopend = /doorlopend/i.test(invoer.soort || '') || !invoer.datum;
  const datum = doorlopend ? '' : invoer.datum;
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { statusCode: 400, body: 'Ongeldige datum' };
  }

  if (!invoer.tijdstip && invoer.starttijd) {
    invoer.tijdstip = invoer.eindtijd ? `${invoer.starttijd}–${invoer.eindtijd}` : invoer.starttijd;
  }

  let aanmeld = invoer.aanmeld || '';
  if (aanmeld && !/^https?:\/\//i.test(aanmeld)) aanmeld = 'https://' + aanmeld;

  const item = {
    titel:        invoer.titel,
    datum,
    tijdstip:     invoer.tijdstip || (doorlopend ? 'Op afspraak' : 'Nader te bepalen'),
    locatie:      invoer.locatie || '',
    organisator:  invoer.organisator || '',
    beschrijving: invoer.beschrijving || '',
    aanmeld,
    prijs:        invoer.prijs || '',
    doorlopend,
    gepubliceerd: process.env.AGENDA_DIRECT_PUBLICEREN === 'true',
    volgorde:     99,
    aangemeld_door: invoer.contact_email || '',
    aangemeld_op:   (payload.createdAt || new Date().toISOString()).slice(0, 10),
  };

  const slug = maakSlug(item.titel);
  const basis = `_agenda/${doorlopend ? 'doorlopend' : datum}-${slug}`;
  const filePath = await vrijBestandspad(basis);

  const inhoud = `---\n${yaml.dump(item, { lineWidth: -1, noRefs: true, sortKeys: false })}---\n`;
  const status = item.gepubliceerd ? 'gepubliceerd' : 'concept';

  try {
    await githubRequest('PUT', filePath, {
      message: `Agenda-aanmelding (${status}): ${item.titel} [skip ci]`,
      content: Buffer.from(inhoud).toString('base64'),
      branch:  process.env.GITHUB_BRANCH || 'main',
    });
  } catch (err) {
    console.error('GitHub commit-fout:', err.message);
    return { statusCode: 500, body: 'Opslaan mislukt: ' + err.message };
  }

  console.log(`Agenda-item aangemaakt (${status}): ${filePath}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true, bestand: filePath, status }) };
};

// Zet een Tally-veld om naar platte tekst (keuzevelden sturen optie-ID's mee)
function tekstwaarde(field) {
  let { value } = field;
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (Array.isArray(field.options)) {
      value = value.map(id => (field.options.find(o => o.id === id) || {}).text || id);
    }
    return value.join(', ').trim();
  }
  return String(value).trim();
}

function maakSlug(tekst) {
  return tekst
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'activiteit';
}

// Voorkom dat een bestaand agenda-item wordt overschreven
async function vrijBestandspad(basis) {
  for (let i = 1; i <= 20; i++) {
    const pad = i === 1 ? `${basis}.md` : `${basis}-${i}.md`;
    try {
      await githubRequest('GET', pad, null);
    } catch (err) {
      if (/GitHub 404/.test(err.message)) return pad;
      throw err;
    }
  }
  return `${basis}-${Date.now()}.md`;
}

// Zelfde controle als tally-webhook.js: HMAC-SHA256, digest als base64
function verifySignature(body, signature, secret) {
  if (!signature) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(JSON.parse(body)))
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function githubRequest(method, filePath, body) {
  const repo = process.env.GITHUB_REPO || 'Drenthe-bewust/drenthe-bewust';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const pad = method === 'GET'
    ? `/repos/${repo}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`
    : `/repos/${repo}/contents/${encodeURI(filePath)}`;
  return new Promise((resolve, reject) => {
    const reqBody = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: 'api.github.com',
      path:     pad,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent':    'drenthe-bewust-webhook/1.0',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        ...(reqBody ? { 'Content-Length': Buffer.byteLength(reqBody) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`GitHub ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}
