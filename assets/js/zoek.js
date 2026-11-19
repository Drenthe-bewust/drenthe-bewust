/* Zoekmenu: gedeelde logica voor de homepage en de pagina bewust-makers.
   Het menu staat in _includes/zoekmenu.html. Dit bestand draait alleen als #zoek-naam bestaat. */
(function () {
  function berekenKm(lat1, lon1, lat2, lon2) {
    var R = 6371, d = Math.PI / 180;
    var dlat = (lat2 - lat1) * d, dlon = (lon2 - lon1) * d;
    var a = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
            Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // Aantal letterfouten (invoegen, weglaten, vervangen) tussen twee woorden
  function levenshtein(a, b) {
    var rij = [], i, j;
    for (j = 0; j <= b.length; j++) rij[j] = j;
    for (i = 1; i <= a.length; i++) {
      var vorig = rij[0];
      rij[0] = i;
      for (j = 1; j <= b.length; j++) {
        var tijdelijk = rij[j];
        rij[j] = Math.min(rij[j] + 1, rij[j - 1] + 1, vorig + (a[i - 1] === b[j - 1] ? 0 : 1));
        vorig = tijdelijk;
      }
    }
    return rij[b.length];
  }

  // Zoekt op de exacte tekst, en daarna per woord met tolerantie voor typefouten.
  // Woorden korter dan 4 letters moeten exact voorkomen; langere woorden mogen 1 fout hebben
  // (2 fouten vanaf 8 letters).
  function past(zoek, tekst) {
    if (!zoek || tekst.indexOf(zoek) !== -1) return true;
    var tokens = tekst.split(/[^a-z0-9à-ÿ]+/).filter(Boolean);
    return zoek.split(/\s+/).filter(Boolean).every(function (woord) {
      if (tekst.indexOf(woord) !== -1) return true;
      if (woord.length < 4) return false;
      var max = woord.length >= 8 ? 2 : 1;
      return tokens.some(function (t) {
        return Math.abs(t.length - woord.length) <= max && levenshtein(t, woord) <= max;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var zoekInput    = document.getElementById('zoek-naam');
    if (!zoekInput) return;

    var woonplaats   = document.getElementById('zoek-woonplaats');
    var onderwerp    = document.getElementById('zoek-onderwerp');
    var chips        = document.querySelectorAll('.js-zoek-chip');
    var makerItems   = document.querySelectorAll('.js-maker');
    var resultaatTxt = document.getElementById('zoek-resultaat');
    var wisBtn       = document.getElementById('wis-filters');
    var afstandWrap  = document.getElementById('afstand-wrap');
    var afstandSlider = document.getElementById('afstand-slider');
    var afstandLabel = document.getElementById('afstand-label');
    var afstandWis   = document.getElementById('afstand-wis');
    var locatieKnop  = document.getElementById('gebruik-locatie');
    var suggestieEl  = document.getElementById('zoek-suggestie');
    var suggesties   = document.querySelectorAll('#zoek-suggesties option');

    // Alleen op de homepage: CTA-blok, "alle bewust-makers"-knop en de willekeurige selectie
    var ctaEl      = document.getElementById('homepage-zoek-cta');
    var ctaTekst   = document.getElementById('homepage-zoek-cta-tekst');
    var ctaLink    = document.getElementById('homepage-zoek-link');
    var allesKnop  = document.getElementById('homepage-alle-knop');
    var ctaBasis   = ctaLink ? ctaLink.getAttribute('href') : '';
    var isHomepage = !!ctaEl;

    var gebruikerLat = null, gebruikerLon = null;

    // Homepage: toon 6 willekeurige bewust-makers bij elke paginalading
    if (isHomepage) {
      var grid = document.getElementById('makers-grid');
      if (grid) {
        var els = Array.prototype.slice.call(grid.querySelectorAll('.js-maker'));
        for (var i = els.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          grid.insertBefore(els[j], els[i]);
          var tmp = els[i]; els[i] = els[j]; els[j] = tmp;
        }
        els.forEach(function (el, idx) {
          el.dataset.initieel = idx < 6 ? 'zichtbaar' : 'verborgen';
        });
      }
    }

    function isGefilterd(naam, tag) {
      return !!naam || tag !== 'alles' || (gebruikerLat !== null && afstandWrap && afstandWrap.style.display !== 'none');
    }

    function filter() {
      var naam = zoekInput.value.toLowerCase().trim();
      var tag = onderwerp && onderwerp.value ? onderwerp.value : 'alles';
      var locActief = gebruikerLat !== null && afstandWrap && afstandWrap.style.display !== 'none';
      var maxKm = afstandSlider ? parseInt(afstandSlider.value, 10) : null;
      var gefilterd = isGefilterd(naam, tag);
      var zichtbaar = 0;

      makerItems.forEach(function (item) {
        var zoekVeld = [
          item.dataset.naam || '',
          item.dataset.omschrijving || '',
          item.dataset.methoden || '',
          item.dataset.tags || '',
          item.dataset.klachten || ''
        ].join(' ').toLowerCase();

        var naamMatch = past(naam, zoekVeld);
        var tagMatch = tag === 'alles' || (item.dataset.tags || '').indexOf(tag) !== -1;

        var afstandMatch = true;
        if (locActief && maxKm) {
          var mLat = parseFloat(item.dataset.lat);
          var mLon = parseFloat(item.dataset.lon);
          if (!isNaN(mLat) && !isNaN(mLon)) {
            afstandMatch = berekenKm(gebruikerLat, gebruikerLon, mLat, mLon) <= maxKm;
          }
        }

        var toon = naamMatch && tagMatch && afstandMatch;
        if (isHomepage && !gefilterd) toon = toon && item.dataset.initieel !== 'verborgen';
        item.style.display = toon ? '' : 'none';
        if (toon) zichtbaar++;
      });

      if (resultaatTxt) {
        resultaatTxt.textContent = gefilterd
          ? zichtbaar + ' bewust-maker' + (zichtbaar !== 1 ? 's' : '') + ' gevonden'
          : '';
      }
      if (wisBtn) wisBtn.style.display = gefilterd ? 'inline-block' : 'none';
      toonSuggestie(naam, zichtbaar);

      if (isHomepage) {
        if (!gefilterd) {
          if (ctaEl) ctaEl.style.display = 'none';
          if (allesKnop) allesKnop.style.display = 'block';
          return;
        }
        if (allesKnop) allesKnop.style.display = 'none';
        // Link naar het gewone overzicht, zonder zoekterm (die geeft op dat overzicht hetzelfde resultaat)
        if (zichtbaar === 0) {
          if (ctaTekst) ctaTekst.textContent = 'Geen bewust-makers gevonden. Er zijn er wel meer — zoek verder in het volledige overzicht.';
          if (ctaLink) { ctaLink.href = ctaBasis; ctaLink.textContent = 'Zoek verder tussen alle bewust-makers'; }
        } else {
          if (ctaTekst) ctaTekst.textContent = 'Er zijn meer bewust-makers beschikbaar in het volledige overzicht.';
          if (ctaLink) { ctaLink.href = ctaBasis; ctaLink.textContent = 'Bekijk alle ' + makerItems.length + '+ bewust-makers'; }
        }
        if (ctaEl) ctaEl.style.display = 'block';
      }
    }

    // Geeft alleen suggesties die ook echt een bewust-maker opleveren (categorieën zonder profiel tellen niet)
    function heeftResultaat(term) {
      return Array.prototype.some.call(makerItems, function (item) {
        var veld = [
          item.dataset.naam || '',
          item.dataset.omschrijving || '',
          item.dataset.methoden || '',
          item.dataset.tags || '',
          item.dataset.klachten || ''
        ].join(' ').toLowerCase();
        return past(term, veld);
      });
    }

    // Bij geen resultaat: zoek de dichtstbijzijnde suggestie uit de lijst ("Bedoelde je ...?")
    function toonSuggestie(naam, zichtbaar) {
      if (!suggestieEl) return;
      suggestieEl.textContent = '';
      var beste = null, beste_afstand = Infinity;
      if (naam && zichtbaar === 0) {
        Array.prototype.forEach.call(suggesties, function (o) {
          var kandidaat = o.value.toLowerCase();
          var d = levenshtein(naam, kandidaat);
          if (d > 0 && d <= Math.max(1, Math.floor(naam.length / 4)) && d < beste_afstand && heeftResultaat(kandidaat)) {
            beste = o.value;
            beste_afstand = d;
          }
        });
      }
      if (!beste) {
        suggestieEl.style.display = 'none';
        return;
      }
      suggestieEl.appendChild(document.createTextNode('Bedoelde je '));
      var knop = document.createElement('button');
      knop.type = 'button';
      knop.className = 'js-suggestie-knop';
      knop.style.cssText = 'background:none; border:none; padding:0; color:var(--groen-donker); font-weight:700; text-decoration:underline; cursor:pointer; font-size:inherit;';
      knop.textContent = beste;
      knop.addEventListener('click', function () {
        zoekInput.value = beste;
        filter();
      });
      suggestieEl.appendChild(knop);
      suggestieEl.appendChild(document.createTextNode('?'));
      suggestieEl.style.display = 'block';
    }

    function setLocatie(lat, lon) {
      gebruikerLat = lat;
      gebruikerLon = lon;
      if (afstandWrap) afstandWrap.style.display = 'block';
      if (afstandLabel) afstandLabel.textContent = 'Binnen ' + (afstandSlider ? afstandSlider.value : 20) + ' km';
      filter();
    }

    function wisLocatie() {
      gebruikerLat = null;
      gebruikerLon = null;
      if (afstandWrap) afstandWrap.style.display = 'none';
      if (woonplaats) woonplaats.value = '';
      if (locatieKnop) locatieKnop.textContent = '📍 Zoek op afstand';
    }

    // Woonplaats: bekende stad → coördinaten en afstandsfilter
    if (woonplaats) {
      woonplaats.addEventListener('input', function () {
        var stad = this.value.trim();
        var coords = (typeof STEDEN_COORDS !== 'undefined') && STEDEN_COORDS[stad];
        if (coords) {
          setLocatie(coords.lat, coords.lon);
        } else if (!stad) {
          wisLocatie();
          filter();
        }
      });
    }

    // GPS als alternatief voor de woonplaats
    if (locatieKnop) {
      locatieKnop.addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Locatie wordt niet ondersteund door jouw browser.'); return; }
        locatieKnop.textContent = '📍 Locatie bepalen...';
        locatieKnop.disabled = true;
        navigator.geolocation.getCurrentPosition(function (pos) {
          if (woonplaats) woonplaats.value = '';
          setLocatie(pos.coords.latitude, pos.coords.longitude);
          locatieKnop.textContent = '📍 Locatie gevonden';
          locatieKnop.disabled = false;
        }, function () {
          alert('Kon locatie niet ophalen. Voer je woonplaats handmatig in.');
          locatieKnop.textContent = '📍 Zoek op afstand';
          locatieKnop.disabled = false;
        });
      });
    }

    if (afstandSlider) {
      afstandSlider.addEventListener('input', function () {
        if (afstandLabel) afstandLabel.textContent = 'Binnen ' + this.value + ' km';
        filter();
      });
    }

    if (afstandWis) {
      afstandWis.addEventListener('click', function () {
        wisLocatie();
        filter();
      });
    }

    zoekInput.addEventListener('input', filter);

    if (onderwerp) onderwerp.addEventListener('change', filter);

    chips.forEach(function (knop) {
      knop.addEventListener('click', function () {
        zoekInput.value = this.dataset.zoek;
        filter();
      });
    });

    if (wisBtn) {
      wisBtn.addEventListener('click', function () {
        zoekInput.value = '';
        if (onderwerp) onderwerp.value = 'alles';
        wisLocatie();
        filter();
      });
    }

    // Links van buiten: ?filter=<onderwerp> en ?zoek=<tekst>
    var params = new URLSearchParams(window.location.search);
    var filterParam = params.get('filter');
    var zoekParam = params.get('zoek');
    if (filterParam && onderwerp) {
      var optie = Array.prototype.find.call(onderwerp.options, function (o) { return o.value === filterParam; });
      if (optie) onderwerp.value = filterParam;
    }
    if (zoekParam) zoekInput.value = zoekParam;

    filter();
  });
})();
