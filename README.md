# D&D Charakterbogen

Digitaler D&D-5e-Charakterbogen für eine Spielgruppe – **digitales Papier mit Transparenz**:
keine Regel-Engine, aber jeder Zahlenwert ist inspizierbar („Warum habe ich RK 17?“ → ein Tipp).

Umgesetzt sind **Phase 1 (MVP)** und **Phase 2 (freies Layout und Spieltisch)** aus dem Design Document.

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

Auslieferung über GitHub Pages: `.github/workflows/deploy.yml` baut mit
`BASE_PATH=/<repo-name>` und veröffentlicht `build/`. Für jeden anderen Static-Host
genügt `npm run build` (bei Unterpfad `BASE_PATH` setzen).

## Aufbau

```
src/lib/engine/    Reines TypeScript, keine UI-Abhängigkeit
  types.ts         Datenmodell (Character, Field, Modifier, Item, …)
  formula.ts       Tokenizer + Pratt-Parser, @-Referenzen, Anzeige ↔ Speicherform
  evaluate.ts      evaluate(character, previous?) – Reihenfolge, Konflikte, Zyklen,
                   inkrementelle Neuberechnung nur abhängiger Felder
src/lib/model/     Standardcharakter (feste IDs std.*), Startlayout, Raster-Logik,
                   Historie/Patches, Import/Migration
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
- **Verwaltung**: Felder, nicht zugeordnete Modifikatoren, Zähler, Zauberlisten und Notizen.

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

Layout (Phase 2): ein Raster aus 12 Spalten mit 40 px Zeilenhöhe für Laptop und iPad. Unter
1024 px Breite skaliert die ganze Seite proportional. Charaktere aus Phase 1 (Schema 1) erhalten
beim Laden das neue Startlayout und die Zauberlisten „Vorbereitet“ und „Bekannt“.

## Noch nicht umgesetzt (Phasen 3–4)

Austausch einzelner Inhalte und 5eTools-Import, Point-Buy- und Hintergrund-Assistent,
weitere Feldtypen.
