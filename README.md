# Drenthe-Bewust – Jekyll/GitHub Pages Website

Een statische kopie van [drenthe-bewust.nl](https://drenthe-bewust.nl), gebouwd met **Jekyll** voor hosting op **GitHub Pages**.

---

## Mappenstructuur

```
drenthe-bewust/
├── _config.yml              ← Site-instellingen (URL, contactgegevens, Formspree)
├── _layouts/
│   └── standaard.html       ← Hoofd HTML-layout (alle pagina's)
├── _includes/
│   ├── nav.html             ← Navigatiebalk
│   ├── footer.html          ← Voettekst
│   └── contactformulier.html ← Herbruikbaar contactformulier
├── assets/
│   ├── css/stijl.css        ← Alle styling (kleuren, layout, componenten)
│   └── js/hoofd.js          ← JavaScript (menu, tellers, formulieren)
├── pages/                   ← Alle pagina's
│   ├── over-drenthe-bewust.html
│   ├── onze-bewust-makers.html
│   ├── mee-maker.html
│   ├── agenda.html
│   ├── kennisbank.html
│   ├── inspiratie.html
│   ├── meld-je-aan.html
│   ├── bewust-maker-formulier.html
│   ├── mee-maker-formulier.html
│   └── contact.html
├── index.html               ← Homepage
├── Gemfile                  ← Ruby dependencies
└── README.md                ← Dit bestand
```

---

## Stap 1: GitHub repository aanmaken

1. Ga naar [github.com](https://github.com) en maak een nieuw repository aan
2. Noem het bijv. `drenthe-bewust` of `drenthe-bewust.nl`
3. Zet het op **Public** (gratis GitHub Pages werkt alleen met public repo's)
4. Upload alle bestanden uit deze map naar de repository

---

## Stap 2: GitHub Pages activeren

1. Ga naar **Settings → Pages** in je repository
2. Kies bij *Source*: **Deploy from a branch**
3. Branch: `main` / `root`
4. Klik **Save**
5. Je site is binnen enkele minuten live op `https://jouwgebruikersnaam.github.io/drenthe-bewust`

Voor een eigen domein (bijv. drenthe-bewust.nl):
- Voeg een `CNAME`-bestand toe met daarin `drenthe-bewust.nl`
- Stel bij je domeinnaamregistrar de DNS in (A-records naar GitHub IP's)

---

## Stap 3: Formulieren instellen via Formspree

De contactformulieren versturen via [Formspree](https://formspree.io) – gratis tot 50 berichten/maand.

1. Maak een account aan op formspree.io
2. Maak een nieuw formulier aan
3. Kopieer de endpoint-URL (bijv. `https://formspree.io/f/abcdefgh`)
4. Plak deze in `_config.yml` bij `formspree_endpoint`

---

## Stap 4: Contactgegevens aanpassen

Open `_config.yml` en pas aan:

```yaml
contact:
  marcella: "06-21312490"
  elsemarie: "06-59111456"
  email: "info@drenthe-bewust.nl"
  facebook: "https://www.facebook.com/share/1NK76U1wML/"
  instagram: "https://instagram.com/nederlandbewust2026"
  whatsapp: "https://wa.me/31659111456"
```

---

## Bewust-makers toevoegen

Open `pages/onze-bewust-makers.html` en voeg een nieuw blok toe:

```html
<div class="maker-kaart">
  <img src="URL_NAAR_FOTO" alt="Naam" class="maker-kaart__foto" loading="lazy">
  <h3 class="maker-kaart__naam">Voornaam Achternaam</h3>
  <p class="maker-kaart__praktijk">Naam Praktijk</p>
  <p class="maker-kaart__bio">"Jouw citaat hier..."</p>
  <p style="font-size:0.88rem; color:#555; margin-bottom:1rem;">Specialiteiten</p>
  <a href="LINK_NAAR_PROFIEL" class="knop knop--groen" style="font-size:0.85rem;">Bekijk profiel</a>
</div>
```

---

## Agenda-items toevoegen

Open `pages/agenda.html` en voeg een nieuw blok toe:

```html
<article class="agenda-item">
  <div class="agenda-datum">
    <div class="agenda-datum__dag">15</div>
    <div class="agenda-datum__maand">Jun</div>
  </div>
  <div class="agenda-info">
    <p class="agenda-info__titel">Naam van het evenement</p>
    <p class="agenda-info__meta">📍 Plaats | ⏰ Tijd | 👤 Organisator</p>
    <p style="font-size:0.9rem; color:#555; margin-top:0.4rem;">Beschrijving...</p>
    <a href="/contact/" class="knop knop--groen" style="font-size:0.82rem; margin-top:0.6rem; padding:0.4rem 1rem;">Aanmelden</a>
  </div>
</article>
```

---

## Tellers aanpassen

De animerende tellers staan in `index.html` en `pages/meld-je-aan.html`. Pas het getal in `data-doel` aan:

```html
<div class="teller__getal" data-doel="25">0</div>
```

---

## Lokaal testen (optioneel)

```bash
# Installeer Jekyll (vereist Ruby)
gem install bundler jekyll

# Ga naar de map
cd drenthe-bewust

# Installeer dependencies
bundle install

# Start lokale server
bundle exec jekyll serve

# Open in browser: http://localhost:4000
```

---

## Kleurenschema aanpassen

Open `assets/css/stijl.css` en pas de CSS-variabelen bovenaan aan:

```css
:root {
  --groen: #4a7c59;          /* Hoofdkleur groen */
  --groen-licht: #6a9c78;
  --groen-donker: #2d5c3a;
  --goud: #c8a96e;           /* Accentkleur goud */
  --creme: #f9f6f0;          /* Achtergrond licht */
}
```

---

## Afbeeldingen

De afbeeldingen zijn nu direct van drenthe-bewust.nl gelinkt. Voor een volledig zelfstandige site:

1. Download de afbeeldingen van drenthe-bewust.nl
2. Sla ze op in `assets/images/`
3. Vervang de URL's in de HTML bestanden

---

*Gebouwd met Jekyll · Gehost op GitHub Pages · Formulieren via Formspree*
