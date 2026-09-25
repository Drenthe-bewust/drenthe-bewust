#!/usr/bin/env node
// Maakt het "Activiteit aanmelden" Tally-formulier via de Tally API
// en koppelt de webhook naar netlify/functions/tally-agenda-webhook.js.
//
// Gebruik:
//   export TALLY_API_TOKEN="jouw-token-van-tally.so/settings/api-keys"
//   node _scripts/maak-tally-agenda-formulier.js
//
// Zet daarna het formulier-ID in _data/instellingen.yml bij agenda_formulier_id.

const https = require('https');
const { randomUUID } = require('crypto');

const TALLY_API_TOKEN = process.env.TALLY_API_TOKEN;
const WEBHOOK_URL = 'https://www.drenthe-bewust.nl/.netlify/functions/tally-agenda-webhook';

if (!TALLY_API_TOKEN) {
  console.error('Fout: stel eerst je Tally API-token in:');
  console.error('  export TALLY_API_TOKEN="jouw-token"');
  console.error('  (Token ophalen: https://tally.so/settings/api-keys)');
  process.exit(1);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(labelHtml, inputType, inputPayload = {}) {
  const titleUuid = randomUUID();
  const inputUuid = randomUUID();
  return [
    { uuid: titleUuid, type: 'TITLE', groupUuid: titleUuid, groupType: 'QUESTION', payload: { html: labelHtml } },
    { uuid: inputUuid, type: inputType, groupUuid: inputUuid, groupType: inputType, payload: { isRequired: false, ...inputPayload } },
  ];
}

function makeDropdown(labelHtml, opties, isRequired = false) {
  const titleUuid = randomUUID();
  const groupUuid = randomUUID();
  return [
    { uuid: titleUuid, type: 'TITLE', groupUuid: titleUuid, groupType: 'QUESTION', payload: { html: labelHtml } },
    ...opties.map((text, i) => ({
      uuid: randomUUID(),
      type: 'DROPDOWN_OPTION',
      groupUuid,
      groupType: 'DROPDOWN',
      payload: { index: i, isFirst: i === 0, isLast: i === opties.length - 1, text, isRequired },
    })),
  ];
}

function makeText(html) {
  const uuid = randomUUID();
  return { uuid, type: 'TEXT', groupUuid: uuid, groupType: 'TEXT', payload: { html } };
}

// ─── formulier ────────────────────────────────────────────────────────────────
// Let op: de vraagteksten moeten exact overeenkomen met VELDEN in tally-agenda-webhook.js

const formTitleUuid = randomUUID();

const blocks = [
  {
    uuid: formTitleUuid,
    type: 'FORM_TITLE',
    groupUuid: formTitleUuid,
    groupType: 'TEXT',
    payload: { title: 'Activiteit aanmelden – Drenthe-Bewust', html: 'Activiteit aanmelden – Drenthe-Bewust' },
  },

  makeText(
    'Organiseer je een workshop, cursus, cirkel of ander evenement? Meld het hier aan voor de ' +
    'agenda van Drenthe-Bewust. We bekijken je aanmelding en zetten hem daarna online.'
  ),

  ...makeQuestion('Naam van de activiteit', 'INPUT_TEXT', { isRequired: true, placeholder: 'bijv. Cacao-ceremonie met groepshealing' }),
  ...makeDropdown('Soort activiteit', ['Op een vaste datum', 'Doorlopend (bijv. wekelijks of op afspraak)'], true),
  ...makeQuestion('Datum', 'INPUT_DATE', { placeholder: 'Laat leeg bij een doorlopende activiteit' }),
  ...makeQuestion('Tijdstip', 'INPUT_TEXT', { placeholder: 'bijv. 10:00–12:30' }),
  ...makeQuestion('Locatie', 'INPUT_TEXT', { isRequired: true, placeholder: 'Adres en plaats, of "Online"' }),
  ...makeQuestion('Georganiseerd door', 'INPUT_TEXT', { isRequired: true, placeholder: 'Jouw naam of praktijknaam' }),
  ...makeQuestion('Korte beschrijving', 'TEXTAREA', { isRequired: true, placeholder: 'Wat gaan deelnemers doen of ervaren? (2-3 zinnen)' }),
  ...makeQuestion('Link voor aanmelden of info', 'INPUT_LINK', { placeholder: 'https://www.jouwwebsite.nl/workshop' }),
  ...makeQuestion('Prijs', 'INPUT_TEXT', { placeholder: 'bijv. €35,- of Gratis' }),
  ...makeQuestion('Jouw e-mailadres', 'INPUT_EMAIL', { isRequired: true, placeholder: 'Zodat we je kunnen bereiken bij vragen (niet zichtbaar op de site)' }),
];

// ─── API ──────────────────────────────────────────────────────────────────────

function tallyRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const reqBody = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.tally.so',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TALLY_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reqBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data ? JSON.parse(data) : {});
        else reject(new Error(`Tally ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(reqBody);
    req.end();
  });
}

(async () => {
  console.log('Formulier aanmaken via Tally API...\n');
  let form;
  try {
    form = await tallyRequest('POST', '/forms', { status: 'PUBLISHED', blocks });
  } catch (err) {
    console.error('❌ Formulier aanmaken mislukt:', err.message);
    process.exit(1);
  }

  console.log('✅ Formulier aangemaakt!');
  console.log(`Formulier-ID : ${form.id}`);
  console.log(`Bekijken     : https://tally.so/r/${form.id}`);
  console.log(`Bewerken     : https://tally.so/forms/${form.id}/edit\n`);

  try {
    await tallyRequest('POST', '/webhooks', { formId: form.id, url: WEBHOOK_URL, eventTypes: ['FORM_RESPONSE'] });
    console.log(`✅ Webhook gekoppeld aan ${WEBHOOK_URL}`);
  } catch (err) {
    console.log('⚠️  Webhook kon niet automatisch worden gekoppeld:', err.message);
    console.log('   Doe het handmatig: Tally → formulier → Integrations → Webhooks →');
    console.log(`   URL: ${WEBHOOK_URL}`);
  }

  console.log('\nVolgende stappen:');
  console.log(`1. Zet in _data/instellingen.yml:  agenda_formulier_id: "${form.id}"`);
  console.log('2. (Aanbevolen) Stel in Tally bij de webhook een signing secret in en zet die in Netlify');
  console.log('   als TALLY_AGENDA_SIGNING_SECRET.');
  console.log('3. (Aanbevolen) Zet in Tally → Settings → "Self email notifications" aan, zodat je bij elke');
  console.log('   aanmelding een mail krijgt om hem te controleren en te publiceren.');
})();
