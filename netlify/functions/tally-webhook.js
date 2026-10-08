// Tally webhook → GitHub API → YAML update → Netlify rebuild
// Ontvang een Tally-formulierinzending, update het profiel in _bewust-makers/,
// en commit de wijziging naar GitHub zodat Netlify automatisch herbouwt.
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
// 'text'   = gewone tekst of textarea
// 'lines'  = textarea met één item per regel → YAML-lijst
// 'array'  = meervoudige keuze (checkboxes) → YAML-lijst
// 'number' = getal
const EDITABLE_FIELDS = {
  // Locatie & contact
  'Provincie':                                   { yamlKey: 'provincie',            type: 'text'   },
  'Stad of plaats':                              { yamlKey: 'stad',                 type: 'text'   },
  'Website':                                     { yamlKey: 'website',              type: 'text'   },
  'E-mail (zichtbaar op profiel)':               { yamlKey: 'email_zichtbaar',      type: 'text'   },
  'Telefoonnummer':                              { yamlKey: 'telefoon',             type: 'text'   },
  'Online sessies':                              { yamlKey: 'online',               type: 'text'   },

  // Praktijkinfo
  'Sessieduur':                                  { yamlKey: 'sessieduur',           type: 'text'   },
  'Tarief (€)':                                  { yamlKey: 'tarief',               type: 'text'   },
  'Gratis kennismaking':                         { yamlKey: 'eerste_gesprek',       type: 'text'   },
  'Vergoeding zorgverzekeraar':                  { yamlKey: 'vergoeding',           type: 'text'   },
  'Jaren ervaring':                              { yamlKey: 'ervaringsjaren',       type: 'number' },

  // Korte teksten
  'Korte omschrijving':                          { yamlKey: 'omschrijving',         type: 'text'   },
  'Citaat of tagline':                           { yamlKey: 'citaat',               type: 'text'   },

  // Lijsten
  'Categorieën':                                 { yamlKey: 'categorieen',          type: 'array'  },
  'Methoden (één per regel)':                    { yamlKey: 'methoden',             type: 'lines'  },
  'Klachten waarmee je helpt (één per regel)':   { yamlKey: 'klachten',             type: 'lines'  },
  'Kaartlabels (één per regel)':                 { yamlKey: 'kaart_tags',           type: 'lines'  },
  'Talen':                                       { yamlKey: 'talen',                type: 'array'  },
  'Doelgroepen (één per regel)':                 { yamlKey: 'doelgroepen',          type: 'lines'  },
  'Opleidingen en certificeringen (één per regel)': { yamlKey: 'opleidingen',       type: 'lines'  },
  'Verenigingen (één per regel)':                { yamlKey: 'verenigingen',         type: 'lines'  },

  // Langere teksten
  'Bio':                                         { yamlKey: 'bio',                  type: 'text'   },
  'Waarom doe je dit werk?':                     { yamlKey: 'waarom',               type: 'text'   },
  'Wat maakt jou uniek?':                        { yamlKey: 'onderscheid',          type: 'text'   },
  'Waarom bel je mij?':                          { yamlKey: 'voor_wie',             type: 'text'   },
  'Waarvoor bel je mij wél?':                    { yamlKey: 'voor_wie',             type: 'text'   }, // oude label
  'Voor wie is jouw werk?':                      { yamlKey: 'voor_wie',             type: 'text'   }, // oude label
  'Wat zeggen cliënten?':                        { yamlKey: 'wat_zeggen_clienten',  type: 'text'   },
  'Wat krijg je mee na een sessie?':             { yamlKey: 'na_sessie',            type: 'text'   },

  // Kennisbank-koppelingen
  'Kennisbank-koppelingen':                      { yamlKey: 'kennisbank_links',     type: 'array'  },
  'Nieuw kennisbank-onderwerp':                  { yamlKey: 'kennisbank_suggestie', type: 'text'   },
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Optioneel: verifieer Tally-handtekening
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

  // Zoek de "naam" of "praktijk" veld om slug van af te leiden
  const naamField = fields.find(f =>
    f.label?.toLowerCase().includes('naam') ||
    f.label?.toLowerCase().includes('praktijk')
  );
  const naam = naamField?.value ? String(naamField.value).trim() : null;

  if (!naam) {
    return { statusCode: 400, body: 'Geen naam/praktijk veld gevonden' };
  }

  // Genereer slug uit naam: lowercase, accenten weg, spaties → streepjes
  function generateSlug(text) {
    return text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')  // accenten verwijderen
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')       // niet-alfanumeriek → streepjes
      .replace(/^-+|-+$/g, '')           // leading/trailing streepjes weg
      .slice(0, 60);                     // max 60 chars
  }

  const slug = generateSlug(naam);
  if (!slug) {
    return { statusCode: 400, body: 'Kan geen geldige slug genereren uit naam' };
  }

  const filePath = `_bewust-makers/${slug}.md`;

  // Haal het huidige bestand op via de GitHub API
  // 404 = profiel bestaat nog niet (nieuw)
  // Andere fouten = echte fout (niet: nieuw profiel aanmaken)
  let fileData = null;
  let isNewProfile = false;
  let existingData = null;

  try {
    fileData = await githubGetFile(filePath);

    // Parse bestaande content om idempotentie te checken
    const rawContent = Buffer.from(fileData.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      try {
        existingData = yaml.load(fmMatch[1]);
      } catch (err) {
        // YAML parsing fout, maar profiel bestaat
        console.error('YAML-fout bij bestaand profiel:', err.message);
      }
    }
  } catch (err) {
    // Alleen 404 = nieuw profiel; alles anders is een echte fout
    if (err.message.includes('GitHub 404')) {
      isNewProfile = true;
      console.log(`Nieuw profiel: ${slug}`);
    } else {
      console.error('GitHub fout:', err.message);
      return { statusCode: 500, body: `GitHub fout: ${err.message}` };
    }
  }

  // IDEMPOTENTIE: Check of deze Tally submission al verwerkt is
  const tallySubmissionId = fields.find(f => f.label === 'submission_id' || f.type === 'HIDDEN_FIELDS')?.value;
  if (tallySubmissionId && existingData?.tally_submission_id === String(tallySubmissionId).trim()) {
    // Dezelfde submission: al verwerkt, geen wijzigingen
    console.log(`Duplicate: submission ${tallySubmissionId} al verwerkt voor ${slug}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, slug, status: 'duplicate', message: 'Submission al verwerkt' })
    };
  }

  // Bouw de profieldata samen
  let data = {};

  if (isNewProfile) {
    // Nieuw profiel: gebruik Tally-velden als basis
    data = {
      layout: 'bewust-maker',
      permalink: '',
      gepubliceerd: false  // EXPLICIET: nieuwe profielen zijn niet gepubliceerd
    };
  } else {
    // Bestaand profiel: gebruik al geparste data
    data = existingData || {};
  }

  // Werk de bewerkbare velden bij (voor zowel nieuw als bestaand)
  let aangepast = false;
  for (const field of fields) {
    const mapping = EDITABLE_FIELDS[field.label];
    if (!mapping) continue;

    const nieuweWaarde = parseVeldwaarde(field, mapping.type);
    if (nieuweWaarde !== null) {
      data[mapping.yamlKey] = nieuweWaarde;
      aangepast = true;
    }
  }

  // Voor bestaande profielen: altijd aangepast (ook zonder wijzigingen)
  // Voor nieuwe profielen: moet minstens één veld hebben
  if (!isNewProfile && !aangepast) {
    return { statusCode: 200, body: 'Geen bewerkbare velden ontvangen' };
  }

  // Sla Tally submission ID op voor idempotentie (opnieuw, omdat Tally het opnieuw kan sturen)
  if (tallySubmissionId) {
    data.tally_submission_id = String(tallySubmissionId).trim();
  }

  // Serialiseer terug naar YAML
  const newYaml = yaml.dump(data, {
    lineWidth: -1,   // geen regelafbreking
    noRefs: true,
    sortKeys: false,
  });
  const newContent = `---\n${newYaml}---\n`;

  // Commit de wijziging naar GitHub
  // [skip ci] → Netlify slaat deze build over
  const action = isNewProfile ? 'Nieuw profiel' : 'Profiel bijgewerkt';
  const commitBericht = `${action}: ${data.naam || slug} [skip ci]`;

  try {
    if (isNewProfile) {
      // Nieuw bestand: CREATE (geen SHA nodig)
      await githubCreateFile(filePath, newContent, commitBericht);
    } else {
      // Bestaand bestand: UPDATE (SHA nodig)
      await githubUpdateFile(filePath, newContent, fileData.sha, commitBericht);
    }
  } catch (err) {
    console.error('GitHub commit-fout:', err.message);
    return { statusCode: 500, body: `Opslaan mislukt: ${err.message}` };
  }

  const status = isNewProfile ? 'pending' : 'updated';
  console.log(`${action}: ${slug} (status: ${status})`);
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, slug, naam: data.naam, status }),
  };
};

// Verwerk een Tally-veldwaarde naar het juiste JavaScript-type
function parseVeldwaarde(field, type) {
  let { value } = field;

  if (value === null || value === undefined) return null;

  // Keuzevelden (dropdown, checkboxes, meerkeuze) sturen optie-ID's mee → omzetten naar tekst
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

  // text
  if (Array.isArray(value)) return value.join(', ');
  return String(value).trim();
}

// Controleer de Tally-HMAC-handtekening
// Tally signeert met HMAC-SHA256 van JSON.stringify(payload), digest als base64
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

// GitHub API-aanroep (GET of PUT)
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
