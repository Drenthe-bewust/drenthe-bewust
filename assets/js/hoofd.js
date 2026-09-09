/* Nederland-Bewust – Hoofd JavaScript */

document.addEventListener('DOMContentLoaded', function () {

  // ===================== MOBIEL MENU =====================
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      const open = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', false);
      });
    });
  }

  // ===================== ACTIEVE NAV =====================
  const huidigPad = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    const href = link.getAttribute('href');
    if (!href) return;
    if (href !== '/' && huidigPad.endsWith(href.replace(/^\/nederland-bewust/, ''))) {
      link.classList.add('actief');
    }
  });

  // ===================== TELLER ANIMATIE =====================
  function animeerTeller(el, eindwaarde, duur) {
    let start = 0;
    const stap = eindwaarde / (duur / 16);
    const interval = setInterval(function () {
      start += stap;
      if (start >= eindwaarde) { start = eindwaarde; clearInterval(interval); }
      el.textContent = Math.floor(start);
    }, 16);
  }
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !entry.target.dataset.geanimeerd) {
        entry.target.dataset.geanimeerd = 'true';
        animeerTeller(entry.target, parseInt(entry.target.dataset.doel, 10), 1400);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.teller__getal[data-doel]').forEach(function (el) { observer.observe(el); });

  // ===================== FORMULIER VIA FORMSPREE =====================
  document.querySelectorAll('.js-formulier').forEach(function (formulier) {
    formulier.addEventListener('submit', async function (e) {
      e.preventDefault();
      const knop = formulier.querySelector('button[type="submit"]');
      const melding = formulier.querySelector('.formulier-melding');
      const ot = knop ? knop.textContent : '';
      if (knop) { knop.textContent = 'Verzenden...'; knop.disabled = true; }
      if (melding) { melding.className = 'formulier-melding'; melding.textContent = ''; }
      try {
        const response = await fetch(formulier.action, {
          method: 'POST', body: new FormData(formulier),
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          if (melding) { melding.className = 'formulier-melding succes'; melding.textContent = 'Bedankt! Je bericht is ontvangen. We nemen zo snel mogelijk contact op.'; }
          formulier.reset();
        } else { throw new Error(); }
      } catch {
        if (melding) { melding.className = 'formulier-melding fout'; melding.textContent = 'Er is iets misgegaan. Mail naar info@nederland-bewust.nl'; }
      } finally {
        if (knop) { knop.textContent = ot; knop.disabled = false; }
      }
    });
  });

  // ===================== AFSTAND HULPFUNCTIE =====================
  function berekenKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const d = Math.PI / 180;
    const dlat = (lat2 - lat1) * d;
    const dlon = (lon2 - lon1) * d;
    const a = Math.sin(dlat/2) * Math.sin(dlat/2) +
              Math.cos(lat1 * d) * Math.cos(lat2 * d) *
              Math.sin(dlon/2) * Math.sin(dlon/2);
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // ===================== ZOEK & FILTER =====================
  const zoekInput       = document.getElementById('zoek-naam');
  const zoekWoonplaats  = document.getElementById('zoek-woonplaats');
  const filterTags      = document.querySelectorAll('.js-tag-filter');
  const klachtTags      = document.querySelectorAll('.js-klacht-filter');
  const makerItems      = document.querySelectorAll('.js-maker');
  const resultaatTxt    = document.getElementById('zoek-resultaat');
  const afstandWrap     = document.getElementById('afstand-wrap');
  const afstandSlider   = document.getElementById('afstand-slider');
  const afstandLabel    = document.getElementById('afstand-label');
  const afstandWis      = document.getElementById('afstand-wis');

  let gebruikerLat = null;
  let gebruikerLon = null;
  let actiefKlacht = null;

  function setLocatie(lat, lon) {
    gebruikerLat = lat;
    gebruikerLon = lon;
    if (afstandWrap)  afstandWrap.style.display = 'block';
    if (afstandLabel) afstandLabel.textContent = 'Binnen ' + (afstandSlider ? afstandSlider.value : 20) + ' km';
    filterMakers();
  }

  function filterMakers() {
    const naam  = zoekInput ? zoekInput.value.toLowerCase().trim() : '';
    const actTag = document.querySelector('.js-tag-filter.actief');
    const tag   = actTag ? actTag.dataset.filter : 'alles';
    const maxKm = afstandSlider ? parseInt(afstandSlider.value) : null;
    const locActief = gebruikerLat !== null && afstandWrap && afstandWrap.style.display !== 'none';

    let zichtbaar = 0;
    makerItems.forEach(function (item) {
      const zoekVeld = [
        item.dataset.naam         || '',
        item.dataset.omschrijving || '',
        item.dataset.methoden     || '',
        item.dataset.tags         || '',
        item.dataset.klachten     || ''
      ].join(' ').toLowerCase();

      const naamMatch   = !naam || zoekVeld.includes(naam);
      const tagMatch    = tag === 'alles' || (item.dataset.tags && item.dataset.tags.includes(tag));
      const klachtMatch = !actiefKlacht || (item.dataset.klachten && item.dataset.klachten.includes(actiefKlacht));

      let afstandMatch = true;
      if (locActief && maxKm) {
        const mLat = parseFloat(item.dataset.lat);
        const mLon = parseFloat(item.dataset.lon);
        if (!isNaN(mLat) && !isNaN(mLon)) {
          afstandMatch = berekenKm(gebruikerLat, gebruikerLon, mLat, mLon) <= maxKm;
        }
      }

      const toon = naamMatch && tagMatch && klachtMatch && afstandMatch;
      item.style.display = toon ? '' : 'none';
      if (toon) zichtbaar++;
    });

    if (resultaatTxt) {
      const isGefilterd = naam || tag !== 'alles' || actiefKlacht || locActief;
      resultaatTxt.textContent = isGefilterd
        ? zichtbaar + ' bewust-maker' + (zichtbaar !== 1 ? 's' : '') + ' gevonden'
        : '';
    }
  }

  if (zoekInput) zoekInput.addEventListener('input', filterMakers);

  // Woonplaats autocomplete → coördinaten opzoeken
  if (zoekWoonplaats) {
    zoekWoonplaats.addEventListener('input', function () {
      const stad = this.value.trim();
      const coords = (typeof STEDEN_COORDS !== 'undefined') && STEDEN_COORDS[stad];
      if (coords) {
        setLocatie(coords.lat, coords.lon);
      } else if (!stad) {
        gebruikerLat = null; gebruikerLon = null;
        if (afstandWrap) afstandWrap.style.display = 'none';
        filterMakers();
      }
    });
  }

  if (afstandSlider) {
    afstandSlider.addEventListener('input', function () {
      if (afstandLabel) afstandLabel.textContent = 'Binnen ' + this.value + ' km';
      filterMakers();
    });
  }

  filterTags.forEach(function (knop) {
    knop.addEventListener('click', function () {
      filterTags.forEach(function (k) { k.classList.remove('actief'); });
      this.classList.add('actief');
      filterMakers();
    });
  });

  klachtTags.forEach(function (knop) {
    knop.addEventListener('click', function () {
      if (this.classList.contains('actief')) {
        this.classList.remove('actief');
        actiefKlacht = null;
      } else {
        klachtTags.forEach(function (k) { k.classList.remove('actief'); });
        this.classList.add('actief');
        actiefKlacht = this.dataset.klacht;
      }
      filterMakers();
    });
  });

  // GPS-knop als alternatief
  const locatieKnop = document.getElementById('gebruik-locatie');
  if (locatieKnop) {
    locatieKnop.addEventListener('click', function () {
      if (!navigator.geolocation) { alert('Locatie wordt niet ondersteund door jouw browser.'); return; }
      locatieKnop.textContent = '📍 Locatie bepalen...';
      locatieKnop.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (zoekWoonplaats) zoekWoonplaats.value = '';
        setLocatie(pos.coords.latitude, pos.coords.longitude);
        locatieKnop.textContent = '📍 Locatie gevonden';
        locatieKnop.disabled = false;
      }, function () {
        alert('Kon locatie niet ophalen. Voer je woonplaats handmatig in.');
        locatieKnop.textContent = '📍 Of gebruik GPS';
        locatieKnop.disabled = false;
      });
    });
  }

  if (afstandWis) {
    afstandWis.addEventListener('click', function () {
      gebruikerLat = null; gebruikerLon = null;
      if (afstandWrap)     afstandWrap.style.display = 'none';
      if (zoekWoonplaats)  zoekWoonplaats.value = '';
      if (locatieKnop)     locatieKnop.textContent = '📍 Of gebruik GPS';
      filterMakers();
    });
  }
});


