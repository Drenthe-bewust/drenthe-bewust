#!/usr/bin/env node
// Maakt het "Profiel bijwerken" Tally-formulier via de Tally API.
//
// Gebruik:
//   export TALLY_API_TOKEN="jouw-token-van-tally.so/settings/api-keys"
//   node _scripts/maak-tally-formulier.js

const https = require('https');
const { randomUUID } = require('crypto');

const TALLY_API_TOKEN = process.env.TALLY_API_TOKEN;
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
    {
      uuid: titleUuid,
      type: 'TITLE',
      groupUuid: titleUuid,
      groupType: 'QUESTION',
      payload: { html: labelHtml },
    },
    {
      uuid: inputUuid,
      type: inputType,
      groupUuid: inputUuid,
      groupType: inputType,
      payload: { isRequired: false, ...inputPayload },
    },
  ];
}

function makeDropdown(labelHtml, opties) {
  const titleUuid = randomUUID();
  const groupUuid = randomUUID();
  const optieBlocks = opties.map((text, i) => ({
    uuid: randomUUID(),
    type: 'DROPDOWN_OPTION',
    groupUuid,
    groupType: 'DROPDOWN',
    payload: {
      index: i,
      isFirst: i === 0,
      isLast: i === opties.length - 1,
      text,
    },
  }));
  return [
    {
      uuid: titleUuid,
      type: 'TITLE',
      groupUuid: titleUuid,
      groupType: 'QUESTION',
      payload: { html: labelHtml },
    },
    ...optieBlocks,
  ];
}

function makeCheckboxes(labelHtml, opties) {
  const titleUuid = randomUUID();
  const groupUuid = randomUUID();
  const checkboxBlocks = opties.map((text, i) => ({
    uuid: randomUUID(),
    type: 'CHECKBOX',
    groupUuid,
    groupType: 'CHECKBOXES',
    payload: {
      index: i,
      isFirst: i === 0,
      isLast: i === opties.length - 1,
      text,
    },
  }));
  return [
    {
      uuid: titleUuid,
      type: 'TITLE',
      groupUuid: titleUuid,
      groupType: 'QUESTION',
      payload: { html: labelHtml },
    },
    ...checkboxBlocks,
  ];
}

function makeHeading(html) {
  const uuid = randomUUID();
  return { uuid, type: 'HEADING_2', groupUuid: uuid, groupType: 'HEADING_2', payload: { html } };
}

function makeText(html) {
  const uuid = randomUUID();
  return { uuid, type: 'TEXT', groupUuid: uuid, groupType: 'TEXT', payload: { html } };
}

// ─── formulier ────────────────────────────────────────────────────────────────

const formTitleUuid = randomUUID();
const hiddenSlugUuid = randomUUID();

const blocks = [
  // Formuliertitel
  {
    uuid: formTitleUuid,
    type: 'FORM_TITLE',
    groupUuid: formTitleUuid,
    groupType: 'TEXT',
    payload: {
      title: 'Profiel bijwerken – Drenthe Bewust',
      html: 'Profiel bijwerken – Drenthe Bewust',
    },
  },

  // Verborgen veld: slug (gevuld via URL ?slug=bas-van-der-tang)
  {
    uuid: hiddenSlugUuid,
    type: 'HIDDEN_FIELDS',
    groupUuid: hiddenSlugUuid,
    groupType: 'HIDDEN_FIELDS',
    payload: { hiddenFields: [{ uuid: randomUUID(), name: 'slug' }] },
  },

  // Intro
  makeText(
    'Hallo! Via dit formulier kun je jouw profiel op Drenthe-Bewust bijwerken. ' +
    'Vul alleen de velden in die je wilt wijzigen — lege velden worden overgeslagen. ' +
    'Na het versturen is jouw profiel binnen 2 minuten bijgewerkt op de website.'
  ),

  // ── Locatie & contact ──
  makeHeading('Locatie &amp; contact'),
  ...makeQuestion('Stad of plaats', 'INPUT_TEXT', { placeholder: 'bijv. Assen' }),
  ...makeDropdown('Provincie', [
    'Drenthe', 'Groningen', 'Friesland', 'Overijssel',
    'Gelderland', 'Utrecht', 'Noord-Holland', 'Zuid-Holland',
    'Zeeland', 'Noord-Brabant', 'Limburg', 'Flevoland',
  ]),
  ...makeQuestion('Website', 'INPUT_LINK', { placeholder: 'https://www.jouwwebsite.nl' }),
  ...makeQuestion('E-mail (zichtbaar op profiel)', 'INPUT_EMAIL', { placeholder: 'jouw@email.nl' }),
  ...makeQuestion('Telefoonnummer', 'INPUT_TEXT', { placeholder: '06-12345678' }),
  ...makeDropdown('Online sessies', ['Ja', 'Op aanvraag', 'Nee']),

  // ── Praktijkinfo ──
  makeHeading('Praktijkinfo'),
  ...makeQuestion('Sessieduur', 'INPUT_TEXT', { placeholder: 'bijv. 60 min of 60-90 min' }),
  ...makeQuestion('Tarief (€)', 'INPUT_TEXT', { placeholder: 'bijv. 85 of 85-110' }),
  ...makeDropdown('Gratis kennismaking', ['Gratis kennismaking', 'Betaald intakegesprek', 'Geen']),
  ...makeQuestion('Vergoeding zorgverzekeraar', 'INPUT_TEXT', { placeholder: 'bijv. Via RBCZ of Nee' }),
  ...makeQuestion('Jaren ervaring', 'INPUT_NUMBER', { placeholder: '7' }),

  // ── Korte teksten ──
  makeHeading('Korte teksten'),
  ...makeQuestion('Korte omschrijving', 'INPUT_TEXT', { placeholder: 'Max. 200 tekens – verschijnt op de kaart' }),
  ...makeQuestion('Citaat of tagline', 'INPUT_TEXT', { placeholder: '"Herstel van binnenuit."' }),

  // ── Categorieën & methoden ──
  makeHeading('Categorieën &amp; methoden'),
  ...makeCheckboxes('Categorieën', [
    'Coaching', 'Bewegen', 'Voeding', 'Energetisch',
    'Mindfulness', 'Lichaamsgericht', 'Spiritueel', 'Psychosociaal',
  ]),
  ...makeQuestion('Methoden (één per regel)', 'TEXTAREA', { placeholder: 'Elke methode op een nieuwe regel\nbijv.\nAdemwerk\nYoga\nMassage' }),
  ...makeQuestion('Klachten waarmee je helpt (één per regel)', 'TEXTAREA', { placeholder: 'bijv.\nvermoeidheid\nstress\nburnout' }),
  ...makeQuestion('Kaartlabels (één per regel)', 'TEXTAREA', { placeholder: 'Max. 3 korte labels\nbijv.\nCoaching\nOnline\nVoeding' }),
  ...makeCheckboxes('Talen', ['Nederlands', 'Engels', 'Duits', 'Frans', 'Spaans']),
  ...makeQuestion('Doelgroepen (één per regel)', 'TEXTAREA', { placeholder: 'bijv.\nVrouwen\nJongvolwassenen\nManagers' }),
  ...makeQuestion('Opleidingen en certificeringen (één per regel)', 'TEXTAREA', { placeholder: 'bijv.\nGecertificeerd coach ICF\nYoga Alliance RYT-200' }),
  ...makeQuestion('Verenigingen (één per regel)', 'TEXTAREA', { placeholder: 'Laat leeg als niet van toepassing' }),

  // ── Jouw verhaal ──
  makeHeading('Jouw verhaal'),
  ...makeQuestion('Bio', 'TEXTAREA', { placeholder: 'Wie ben je? Wat drijft je? (2-4 alinea\'s werkt het best)' }),
  ...makeQuestion('Waarom doe je dit werk?', 'TEXTAREA', { placeholder: 'Wat is de achtergrond van jouw keuze voor dit werk?' }),
  ...makeQuestion('Wat maakt jou uniek?', 'TEXTAREA', { placeholder: 'Hoe onderscheidt jouw aanpak zich?' }),
  ...makeQuestion('Waarom bel je mij?', 'TEXTAREA', { placeholder: 'Voor wie ben jij de juiste keuze? Beschrijf jouw ideale cliënt' }),
  ...makeQuestion('Wat zeggen cliënten?', 'TEXTAREA', { placeholder: '"Citaat cliënt" – naam (optioneel)' }),
  ...makeQuestion('Wat krijg je mee na een sessie?', 'TEXTAREA', { placeholder: 'Beschrijf het resultaat of gevoel na een sessie' }),
];

// ─── API-aanroep ───────────────────────────────────────────────────────────────

const body = JSON.stringify({ status: 'PUBLISHED', blocks });

const options = {
  hostname: 'api.tally.so',
  path: '/forms',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TALLY_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('Formulier aanmaken via Tally API...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const form = JSON.parse(data);
      const id = form.id;
      console.log('✅ Formulier aangemaakt!');
      console.log(`Formulier-ID : ${id}`);
      console.log(`Bekijken     : https://tally.so/r/${id}`);
      console.log(`Bewerken     : https://tally.so/forms/${id}/edit\n`);

      console.log('Persoonlijke links per bewust-maker:');
      console.log('─'.repeat(60));
      const makers = [
        { naam: 'Bas van der Tang',            slug: 'bas-van-der-tang' },
        { naam: 'By Juud (Judith Hendriks)',   slug: 'byjuud' },
        { naam: 'Change Your Lifestyle',        slug: 'change-your-lifestyle' },
        { naam: 'Het Zonnepad',                 slug: 'het-zonnepad' },
        { naam: 'Linda',                        slug: 'linda' },
        { naam: 'Mesologie Vanuit het Hart',    slug: 'mesologie-vanuit-het-hart' },
        { naam: 'Ponti Noi',                    slug: 'ponti-noi' },
        { naam: 'Praktijk Katharos',            slug: 'praktijk-katharos' },
        { naam: 'Sjouk',                        slug: 'voel-je-veilig-en-welkom-by-sjouk' },
        { naam: 'Atlamodi',                     slug: 'welkom-bij-atlamodi' },
        { naam: 'Hands4Flow (Elsemarie)',       slug: 'welkom-bij-hands4flow' },
        { naam: 'Mindful Inspirations',         slug: 'welkom-bij-mindful-inspirations' },
        { naam: 'Praktijk De Kezel (Marcella)', slug: 'welkom-bij-nei-praktijk-de-kezel' },
        { naam: 'Praktijk Heike Plomp',         slug: 'welkom-bij-praktijk-heike-plomp' },
        { naam: 'Praktijk Janet van der Veen',  slug: 'welkom-bij-praktijk-janet-van-der-veen' },
      ];
      makers.forEach(({ naam, slug }) => {
        console.log(`${naam.padEnd(32)} https://tally.so/r/${id}?slug=${slug}`);
      });
      console.log('\nBewaar het formulier-ID voor de webhook-configuratie in Netlify.');
    } else {
      console.error(`❌ Fout ${res.statusCode}:`);
      try {
        const err = JSON.parse(data);
        console.error(JSON.stringify(err, null, 2));
      } catch {
        console.error(data);
      }
    }
  });
});

req.on('error', (err) => console.error('Verbindingsfout:', err.message));
req.write(body);
req.end();
