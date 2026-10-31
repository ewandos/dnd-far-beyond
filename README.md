# D&D Charakterbogen

Digitaler D&D-5e-Charakterbogen für eine Spielgruppe – **digitales Papier mit Transparenz**:
keine Regel-Engine, aber jeder Zahlenwert ist inspizierbar („Warum habe ich RK 17?“ → ein Tipp).

Umgesetzt sind alle vier Phasen aus dem Design Document: **MVP**, **freies Layout und Spieltisch**, **Austausch** sowie **Komfort und Erweiterungen**.

## Starten

```bash
npm install
npm run dev          # Entwicklung, http://localhost:5173
npm run build        # statische App nach build/
npm run preview      # gebaute App ansehen (inkl. Service Worker)
```

Tests:

```bash
npm test             # Vitest: Engine, Formeln, Historie, Import, Markdown
npm run test:coverage
npm run test:e2e     # Playwright: Abnahmekriterien auf Laptop und iPad hochkant
npm run check        # svelte-check / TypeScript strikt
```

Jeder Pull Request durchläuft `.github/workflows/ci.yml`: Typprüfung, Unit-Tests und die
Playwright-Tests; bei Fehlschlägen liegt der Playwright-Bericht als Artefakt bereit.

Auslieferung über GitHub Pages: `.github/workflows/deploy.yml` baut mit
`BASE_PATH=/<repo-name>` und veröffentlicht `build/`. Für jeden anderen Static-Host
genügt `npm run build` (bei Unterpfad `BASE_PATH` setzen).

## Aufbau

```
src/lib/engine/    Reines TypeScript, keine UI-Abhängigkeit
  types.ts         Datenmodell (Character, Field, Modifier, Item, …)
  formula.ts       Tokenizer + Pratt-Parser, @-Referenzen, Anzeige ↔ Speicherform
  dice.ts          Würfelausdrücke (Summen aus Würfeln und Formeln) und Listen
  evaluate.ts      evaluate(character, previous?) – Reihenfolge, Konflikte, Zyklen,
                   inkrementelle Neuberechnung nur abhängiger Felder
src/lib/model/     Standardcharakter (feste IDs std.*), Startlayout, Raster-Logik,
                   Historie/Patches, Import/Migration, Austauschformat, 5eTools-Konverter,
                   Point-Buy, Hintergrund-Assistent
src/lib/store/     Svelte-5-Zustand (Runes), Aktionen mit Historie, IndexedDB (Dexie), Dateien
src/lib/ui/        Komponenten, Layout-Raster und Bausteine, Inspektionspanel,
                   Drag & Drop (Pointer Events)
src/service-worker.ts  Offline-first-Cache aller App-Dateien
```

### Engine in Kürze

- Endwert = Basiswert → **Setzen** (höchster gilt, mehrere = Konflikt) → **Addieren** →
  **Multiplizieren/Teilen** (Rundung je Modifikator, Standard abrunden).
- Quellen entscheiden, ob ein Modifikator wirkt: feldeigen (immer), Item (liegt direkt in
  einem „ausgerüsteten“ Container), Fähigkeit/Zustand (Schalter), Übung (Stufe ≠ keine,
  Faktor ×0,5 abgerundet / ×1 / ×2).
- Formeln: Zahlen, `+ − × /`, Klammern, `floor ceil round min max`, Referenzen `@Name`.
  Gespeichert wird `@[feld-id]`, angezeigt der aktuelle Name – Umbenennen bricht nichts.
- Zirkelbezüge (Tarjan-SCC) und ungültige Formeln werden markiert und ignoriert; die App
  stürzt nie ab.
- Einzige automatische Zählung: „Eingestimmte Items“; Überschreitung ist nur ein Hinweis.

## Bedienung

- **Layout**: Jeder Charakter hat eigene Tabs mit frei anordenbaren Bausteinen (Feld, Feldgruppe,
  Kästchen/Zähler, Container, Karten-Liste, Textblock) auf einem 12-Spalten-Raster.
  **Spielmodus** (Standard) fixiert das Layout. Der Knopf **Layout** oben schaltet in den
  **Bearbeitungsmodus**: Bausteine ziehen, an der Ecke unten rechts Größe ändern, über den Stift
  einstellen, hinzufügen, entfernen; Tabs umbenennen, umsortieren, ausblenden, anlegen, löschen.
  Mit der Tastatur: Baustein fokussieren, Pfeiltasten verschieben, Umschalt+Pfeil ändert die Größe.
  Überdeckte Bausteine rutschen nach unten, nichts rückt von selbst nach oben. Layout-Änderungen
  stehen in der Historie und lassen sich rückgängig machen.
- **Zauber**: Zauberkarten mit Grad, Schule, Zeitaufwand, Reichweite, Komponenten, Dauer,
  Konzentration/Ritual, Tags und Markdown-Beschreibung. Frei benennbare Zauberlisten (Start:
  „Vorbereitet“, „Bekannt“); ein Zauber kann in mehreren Listen stehen. Zauberplätze sind
  Zähler pro Grad („Anzahl ändern“ im Baustein). Konzentration lässt sich mit einem Tipp als
  Zustand eintragen.
- **Aktionsübersicht** (Tab „Aktionen“, als Baustein überall platzierbar): Spalten für Aktionen,
  Bonusaktionen, Reaktionen und Sonstiges. Einträge kommen aus drei Quellen:
  - eigene Aktionen, frei oder an einem Item bzw. einer Fähigkeit („Aktion hinzufügen“ in der
    Karte, z. B. „Angriff: Langschwert“). Aktionen an Items sind nur verfügbar, solange das Item
    ausgerüstet ist; sonst stehen sie ausgegraut mit Grund da;
  - Zauber aus gewählten Listen (Standard: „Vorbereitet“). Die Art folgt dem Zeitaufwand
    („1 Bonusaktion“ → Bonusaktionen) und lässt sich in der Zauberkarte überschreiben;
  - allgemeine Aktionen wie Spurt, Ausweichen oder Gelegenheitsangriff (abschaltbar, löschbar).
  Angriffsbonus, Schaden und Rettungswurf-SG sind optionale Formeln wie bei Modifikatoren
  (`@STR-Mod + @Übungsbonus`, `1d8 + @STR-Mod`) und erscheinen aufgelöst. Gewürfelt wird nicht.
  Aktionen an Items und Fähigkeiten reisen beim Austausch mit; 5eTools-Waffen bringen eine
  Angriffsaktion mit Schadenswürfel mit (den Angriffsbonus trägt man selbst ein).
- **Verwaltung**: Felder, nicht zugeordnete Modifikatoren, Zähler, Zauberlisten und Notizen.
- **Austausch** (Phase 3): Items, Fähigkeiten, Zustände und Zauber einzeln (Knopf „Exportieren“
  in der Karte) oder gesammelt (Verwaltung → Exportieren) als JSON weitergeben. Import über den
  Upload-Knopf oben: Einträge auswählen, Ziel-Container und Zauberliste wählen. Importiert werden
  immer Kopien mit neuer ID, die Ursprungs-ID wird gespeichert; ein erneuter Import legt ein
  zweites Item an. Modifikatoren auf Standardfelder treffen automatisch, alle anderen kommen als
  „nicht zugeordnet“ an (mit dem ursprünglichen Feldnamen als Hinweis) – die App legt nie selbst
  Felder an.
- **5eTools-Import**: 5eTools-JSON mit `spell`, `item`, `baseitem`, `magicvariant` oder `feat`.
  `entries` werden zu Markdown (Absätze, benannte Abschnitte, Listen, Tabellen, Kästen),
  Inline-Tags wie `{@damage 1d8}` oder `{@spell fireball}` zu lesbarem Text. Mechanische Angaben
  werden bewusst nicht zu Modifikatoren.
- **Feldtypen** (Phase 4): Neben **Zahl** gibt es **Würfelausdruck** (Basis z. B. `1d8`,
  Modifikatoren wie `@STR-Mod` oder `1W6` werden zu „1d8 + 1d6 + 3“ zusammengefasst, Würfel
  gleicher Größe addiert) und **Liste** (z. B. Sprachen; Addieren hängt Einträge ohne Dubletten
  an, Setzen ersetzt). Bei beiden gibt es nur Setzen und Addieren. Würfelfelder dürfen in
  Würfelausdrücken anderer Felder vorkommen, in Zahlenformeln nicht. Gewürfelt wird nie.
- **Point-Buy-Rechner** (Verwaltung → Assistenten): Standardkosten, Budget frei wählbar, Bonus-
  Spalte, auf Wunsch werden die Attributsmodifikatoren gleich mit eingetragen. Überschreitungen
  sind nur ein Hinweis.
- **Hintergrund-Assistent**: Name, Fertigkeiten (werden „geübt“, Expertise bleibt erhalten),
  Werkzeuge, Sprachen, optionale Attributserhöhungen (+2/+1 oder +1/+1/+1) als Modifikatoren
  einer Fähigkeit „Hintergrund“ – also inspizierbar und abschaltbar –, Merkmal oder
  Herkunftstalent, Ausrüstung (eine Zeile pro Gegenstand, „5x Kerze“), Gold und Geschichte.
  Alles in einem Schritt, ein Rückgängig nimmt alles zurück.

- **Wert antippen** → Inspektionspanel: Endwert, Basiswert (editierbar), alle Modifikatoren in
  Auswertungsreihenfolge mit Quelle, Formel, aufklappbaren Referenzketten, inaktive
  Modifikatoren ausgegraut mit Grund, Konflikt-/Fehlerhinweise, Sprung zur Quelle,
  Quellen direkt an-/ausschalten, Modifikator hinzufügen.
- **Schnellanlage** (Übersicht, Inventar, Fähigkeiten): Name, optional Feld + Operation + Wert, Enter.
- **Übungs-Marker** antippen: keine → geübt → Expertise → halb.
- **Inventar**: verschachtelte Container, Items am Griff ziehen (Maus und Touch), Container als
  „ausgerüstet“ markieren.
- **Rückgängig/Wiederholen**: Knöpfe oben oder ⌘/Strg+Z, ⌘/Strg+Umschalt+Z. Verlauf-Tab mit Filter.
- **Export** oben rechts (auf dem iPad über das Teilen-Menü, z. B. nach iCloud Drive), Import auf
  der Startseite. Die Datei enthält Felder, Modifikatoren, Inhalte, Layout und Historie.

## Getroffene Annahmen (offene Punkte aus dem Design Document)

| Offener Punkt | Umgesetzt als |
| --- | --- |
| Mehrere Setzen-Modifikatoren | höchster Wert gilt, Konfliktsymbol am Feld |
| Rundung bei Multiplizieren/Teilen | Standard abrunden, pro Modifikator änderbar (auf, kaufmännisch, keine) |
| Historie in der Export-Datei | ja, die letzten 2000 Ereignisse |
| Auslieferung | GitHub Pages per Workflow; jeder Static-Host funktioniert |

Weitere Festlegungen: Bewegungsrate in Metern (Basis 9), schnelle Folgeänderungen am selben
Wert werden innerhalb von 3 s zu einem Verlaufseintrag zusammengefasst, Import mit bereits
vorhandener Charakter-ID fragt „Ersetzen“ oder „Als Kopie“.

Aktionsübersicht: Schema 3. Bestehende Charaktere erhalten die allgemeinen Aktionen und einen
neuen Tab „Aktionen“ am Ende – ihr eigenes Layout bleibt unverändert.

Layout (Phase 2): ein Raster aus 12 Spalten mit 40 px Zeilenhöhe für Laptop und iPad. Unter
1024 px Breite skaliert die ganze Seite proportional. Charaktere aus Phase 1 (Schema 1) erhalten
beim Laden das neue Startlayout und die Zauberlisten „Vorbereitet“ und „Bekannt“.

## Später (aus dem Design Document, bewusst nicht umgesetzt)

Live-Referenzen in Textblöcken, Handy-Ansicht, Layout-Vorlagen teilen, Bibliothek pro Gerät,
Erkennen und Aktualisieren bereits importierter Items, 5eTools-Import für Völker, Klassen und
Hintergründe.
