// Tally webhook → GitHub API → YAML update → Netlify rebuild
// Ontvang een Tally-formulierinzending, create nieuw profiel in _bewust-makers-pending/
// met gepubliceerd: false, zodat Marcella/Elsemarie het kan modereren.
//
// Vereiste omgevingsvariabelen (stel in via Netlify > Site settings > Environment):
//   GITHUB_TOKEN   — Personal Access Token met 'Contents: Read & write' op de repo
//   GITHUB_REPO    — bijv. Drenthe-bewust/drenthe-bewust  (standaard ingesteld)
//   GITHUB_BRANCH  — bijv. main  (standaard ingesteld)
//   TALLY_SIGNING_SECRET — (optioneel) webhook-handtekeninggeheim uit Tally

const https = require('https');
const crypto = require('crypto');
const yaml = require('js-yaml');

// Koppeling: Tally-veldlabel → YAML-sleutel + type
const EDITABLE_FIELDS = {
  'Provincie':                                   { yamlKey: 'provincie',            type: 'text'   },
  'Stad of plaats':                              { yamlKey: 'stad',                 type: 'text'   },
  'Website':                                     { yamlKey: 'website',              type: 'text'   },
  'E-mail (zichtbaar op profiel)':               { yamlKey: 'email_zichtbaar',      type: 'text'   },
  'Telefoonnummer':                              { yamlKey: 'telefoon',             type: 'text'   },
  'Online sessies':                              { yamlKey: 'online',               type: 'text'   },
  'Sessieduur':                                  { yamlKey: 'sessieduur',           type: 'text'   },
  'Tarief (€)':                                  { yamlKey: 'tarief',               type: 'text'   },
  'Gratis kennismaking':                         { yamlKey: 'eerste_gesprek',       type: 'text'   },
  'Vergoeding zorgverzekeraar':                  { yamlKey: 'vergoeding',           type: 'text'   },
  'Jaren ervaring':                              { yamlKey: 'ervaringsjaren',       type: 'number' },
  'Korte omschrijving':                          { yamlKey: 'omschrijving',         type: 'text'   },
  'Citaat of tagline':                           { yamlKey: 'citaat',               type: 'text'   },
  'Categorieën':                                 { yamlKey: 'categorieen',          type: 'array'  },
  'Methoden (één per regel)':                    { yamlKey: 'methoden',             type: 'lines'  },
  'Klachten waarmee je helpt (één per regel)':   { yamlKey: 'klachten',             type: 'lines'  },
  'Kaartlabels (één per regel)':                 { yamlKey: 'kaart_tags',           type: 'lines'  },
  'Talen':                                       { yamlKey: 'talen',                type: 'array'  },
  'Doelgroepen (één per regel)':                 { yamlKey: 'doelgroepen',          type: 'lines'  },
  'Opleidingen en certificeringen (één per regel)': { yamlKey: 'opleidingen',       type: 'lines'  },
  'Verenigingen (één per regel)':                { yamlKey: 'verenigingen',         type: 'lines'  },
  'Bio':                                         { yamlKey: 'bio',                  type: 'text'   },
  'Waarom doe je dit werk?':                     { yamlKey: 'waarom',               type: 'text'   },
  'Wat maakt jou uniek?':                        { yamlKey: 'onderscheid',          type: 'text'   },
  'Waarom bel je mij?':                          { yamlKey: 'voor_wie',             type: 'text'   },
  'Waarvoor bel je mij wél?':                    { yamlKey: 'voor_wie',             type: 'text'   },
  'Voor wie is jouw werk?':                      { yamlKey: 'voor_wie',             type: 'text'   },
  'Wat zeggen cliënten?':                        { yamlKey: 'wat_zeggen_clienten',  type: 'text'   },
  'Wat krijg je mee na een sessie?':             { yamlKey: 'na_sessie',            type: 'text'   },
  'Kennisbank-koppelingen':                      { yamlKey: 'kennisbank_links',     type: 'array'  },
  'Nieuw kennisbank-onderwerp':                  { yamlKey: 'kennisbank_suggestie', type: 'text'   },
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (process.env.TALLY_SIGNING_SECRET) {
    const sig = event.headers['tally-signature'];
    if (!verifySignature(event.body, sig, process.env.TALLY_SIGNING_SECRET)) {
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

  const tallySubmissionId = payload?.submissionId || payload?.data?.id;

  // DEBUG: log alle veldnamen die Tally stuurt
  console.log('Tally field labels:', fields.map(f => f.label).join(' | '));

  // Genereer stabiele slug: timestamp + submission ID (niet gebruikersafhankelijk)
  function generateStableSlug() {
    const timestamp = Date.now().toString().slice(-6);
    const subId = tallySubmissionId ? String(tallySubmissionId).substring(0, 6) : 'new';
    return `aanmelding-${timestamp}-${subId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  const slug = generateStableSlug();
  console.log(`Generated slug: ${slug} from submission ${tallySubmissionId}`);

  const filePath = `_bewust-makers-pending/${slug}.md`;

  // Bouw de profieldata samen
  const data = {
    layout: 'bewust-maker',
    permalink: '',
    gepubliceerd: false
  };

  // Werk de bewerkbare velden bij
  for (const field of fields) {
    const mapping = EDITABLE_FIELDS[field.label];
    if (!mapping) continue;

    const nieuweWaarde = parseVeldwaarde(field, mapping.type);
    if (nieuweWaarde !== null) {
      data[mapping.yamlKey] = nieuweWaarde;
    }
  }

  // Sla Tally submission ID op voor idempotentie
  if (tallySubmissionId) {
    data.tally_submission_id = String(tallySubmissionId).trim();
  }

  // Serialiseer naar YAML
  const newYaml = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  const newContent = `---\n${newYaml}---\n`;

  const commitBericht = `Tally-aanmelding: ${data.naam || slug} [skip ci]`;

  try {
    await githubCreateFile(filePath, newContent, commitBericht);
  } catch (err) {
    console.error('GitHub commit-fout:', err.message);
    return { statusCode: 500, body: `Opslaan mislukt: ${err.message}` };
  }

  console.log(`Aanmelding aangemaakt: ${slug}`);
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, slug, naam: data.naam, status: 'pending' }),
  };
};

function parseVeldwaarde(field, type) {
  let { value } = field;

  if (value === null || value === undefined) return null;

  if (Array.isArray(value) && Array.isArray(field.options)) {
    value = value.map(id => (field.options.find(o => o.id === id) || {}).text).filter(Boolean);
    if (value.length === 0) return null;
  }

  if (type === 'number') {
    const n = parseFloat(String(value).replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  if (type === 'lines') {
    if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
    return String(value).split('\n').map(s => s.trim()).filter(Boolean);
  }

  if (type === 'array') {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    return value ? [String(value).trim()] : [];
  }

  if (Array.isArray(value)) return value.join(', ');
  return String(value).trim();
}

function verifySignature(body, signature, secret) {
  if (!signature) return false;
  try {
    const payload = JSON.parse(body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function githubRequest(method, filePath, body) {
  const repo = process.env.GITHUB_REPO || 'Drenthe-bewust/drenthe-bewust';
  return new Promise((resolve, reject) => {
    const reqBody = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${repo}/contents/${filePath}`,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent':    'drenthe-bewust-webhook/1.0',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        ...(reqBody ? { 'Content-Length': Buffer.byteLength(reqBody) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

function githubGetFile(filePath) {
  return githubRequest('GET', filePath, null);
}

function githubCreateFile(filePath, content, message) {
  return githubRequest('PUT', filePath, {
    message,
    content:  Buffer.from(content).toString('base64'),
    branch:   process.env.GITHUB_BRANCH || 'main',
  });
}

function githubUpdateFile(filePath, content, sha, message) {
  return githubRequest('PUT', filePath, {
    message,
    content:  Buffer.from(content).toString('base64'),
    sha,
    branch:   process.env.GITHUB_BRANCH || 'main',
  });
}
