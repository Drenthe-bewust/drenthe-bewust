# Handleiding: Profielen Goedkeuren & Publiceren

Hallo Elsemarie en Marcella! 👋

Dit is hoe je nieuwe Tally-aanmeldingen beoordeelt en goedkeurt voor publicatie.

---

## STAP 1: Inloggen CMS

Ga naar: **https://www.drenthe-bewust.nl/admin/**

Login met GitHub → je ziet je CMS dashboard.

---

## STAP 2: Nieuwe aanmeldingen bekijken

Linkerkant menu → **"Tally-aanmeldingen — Modereren"**

Je ziet nu alle inzendingen van het Tally-formulier.
Klik op een profiel om het volledige formulier in te zien.

---

## STAP 3: Controleren (alle velden zichtbaar!)

Je ziet NU **ALLE 27 VELDEN** die iemand heeft ingevuld:

**Basisgegevens:** Naam, Praktijk, Stad, Provincie, Website, Email, Telefoon, Online, Tarief

**Specialisatie:** Categorieën, Methoden, Klachten, Doelgroepen, Opleidingen, Verenigingen, Talen

**Beschrijvingen:** Bio, Waarom dit werk, Wat maakt je anders, Citaat, Voor wie, Testimonials

Controleer alles. Pas aan als nodig → **Opslaan**.

---

## STAP 4: PUBLICEREN! 

**Helemaal onderaan** zie je:

```
☐ Gepubliceerd
```

**Dit is de magic button!** 

- Zet het vinkje AAN (☑️ Gepubliceerd)
- Klik **Opslaan**

→ **KLAAR!** Het profiel gaat live! 🎉

---

## STAP 5: Wat gebeurt nu?

1. Git Gateway committet naar GitHub
2. GitHub Action detecteert `gepubliceerd: true`
3. Action verplaatst bestand naar gepubliceerd folder
4. Netlify rebuild start
5. Website toont het profiel

**Dit duurt ~1-2 minuten.**

---

## Controleren of het werkt

### Website check
Ga naar: https://www.drenthe-bewust.nl/onze-bewust-makers/

Zie je het nieuwe profiel? ✓

### Persoon zoeken
- Zoek op naam
- Klik op profiel
- Staat alles correct?

---

## Wat als het fout gaat?

**"Ik zette per ongeluk Gepubliceerd: TRUE!"**

Geen paniek!
1. Open profiel
2. Zet `Gepubliceerd: FALSE`
3. Opslaan
4. Profiel verdwijnt

---

## FAQ

**V: Kan ik later wijzigingen maken?**
A: Ja! Open profiel, wijzig, opslaan. Klaar.

**V: Hoe lang tot het live is?**
A: ~1-2 minuten. Website rebuild automatisch.

**V: Welke velden zijn verplicht?**
A: Naam, Praktijk, Stad, Provincie, Categorieën, Bio. Controleer in CMS.

**V: Waar is het Tally-formulier?**
A: https://tally.so/r/VLrgJy

---

## KORT SAMENGEVAT

1. **CMS** → Tally-aanmeldingen
2. **Klik** profiel → controleer alles
3. **Zet** Gepubliceerd: TRUE
4. **Opslaan**
5. **Website update automatisch** ✨

---

Veel sterkte, jullie redden het! 💪
