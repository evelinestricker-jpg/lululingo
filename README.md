# Lululingo

En web-app til iPhone, hvor man lærer japansk med maskotten Lulu.

- **Se:** Lulu-afsnit med klikbare japanske undertekster (furigana, romaji, dansk/engelsk).
- **Kort:** flashcards med automatisk gentagelse (spaced repetition).
- **Lulu:** AI-samtale på japansk med Claude, tilpasset dit niveau.
- **Lær:** hiragana, katakana og simple kanji med tegneøvelse.
- **Spil:** Partikel-jagt, Sætningsbyggeren og Kana-quiz.

Al data (kort, fremskridt, API-nøgle) gemmes kun i browseren på telefonen.

## Prøv den derhjemme

```powershell
npm run serve:lan
```

Åbn den adresse, der vises, i Safari på iPhonen (samme Wi-Fi).

## Online (GitHub Pages)

Appen ligger på **https://evelinestricker-jpg.github.io/lululingo/**.

Selve appen ligger i mappen **`docs`**. GitHub Pages viser den mappe direkte fra `main`, så hver gang der sendes ændringer til GitHub, er de online et minut efter. Hæv `VERSION` i `docs/sw.js`, så telefonerne henter de nye filer.

På iPhonen: åbn adressen i Safari → Del → **Føj til hjemmeskærm**.

Repoet er offentligt. Læg aldrig API-nøgler i koden – de skal kun ind i appens Indstillinger på telefonen.

## Lulu-afsnittene (tegnefilm)

Afsnittene er små tegnefilm. Tegnefilmsmotoren `docs/js/cartoon.js` tegner scener, figurer (Lulu, Momo og Pon) og effekter i SVG. Den styrer dem ud fra afsnittets tidslinje, så alt følger lyden, også når man spoler. Munden bevæger sig efter stemmens lydstyrke.

Lav et nyt afsnit sådan her:

1. Kopiér fx `episodes/ep02/script.json` til `episodes/ep05/script.json`, og skriv det nye manuskript.
   - Replikker skrives med mellemrum mellem ordene (`"jp": "いちご が 好き ！"`). Ordene slås op i `episodes/lexicon.json`. Nye ord tilføjes dér.
   - Pauser uden tale: `{ "beat": 2 }`.
   - Tegnefilmen styres med `scene`, `sky`, `pos`, `act`, `hold`, `props`, `fx`, `cam` og `face`.
   - Forsiden i biblioteket vælges med `"cover"`. Den bruger de samme felter som en scene, plus `t` for det øjeblik, der vises.
   - Lyden styres med `music` (happy, calm, rain, party, quiet, none) og `sfx`.
2. Start VOICEVOX-motoren (VOICEVOX-programmet, eller `vv-engine\run.exe`).
3. Kør:

```powershell
powershell -ExecutionPolicy Bypass -File tools\generate-episode.ps1 -Episode ep05
```

Lyd, musik, effekter, undertekster og tidslinje havner i `docs/episodes/ep05/`, og afsnittet kommer automatisk med i biblioteket.

## Rigtige videoer (YouTube)

Under **Se** ligger der, ud over Lulu-afsnittene, også rigtige japanske videoer fra YouTube. De afspilles med YouTubes egen afspiller og har de samme klikbare undertekster som Lulu-afsnittene (furigana, romaji, oversættelse, ordopslag, flashcards og »Gentag replik«).

Tilføj en ny video sådan her:

1. Find en video, der må vises i andre apps (indlejring slået til), og som helst har japanske undertekster lavet af en person.
2. Lav `videos/<YouTube-id>/script.json` med samme felter som `videos/qJfQyxwVIw4/script.json`. Hver replik får `start` og `end` i sekunder, `jp` med mellemrum mellem ordene, samt `da` og `en`. Ordene slås op i `episodes/lexicon.json`, og nye ord tilføjes dér.
3. Kør:

```powershell
node tools/build-videos.js
```

Underteksterne havner i `docs/videos/<YouTube-id>/`, og videoen kommer automatisk med i biblioteket.

Underteksterne er afskrevet fra videoernes egne japanske undertekster. Spørg kanalen om lov, før appen udgives bredt eller tjener penge.

## AI-chatten

Under Indstillinger vælger man AI-udbyder og indsætter sin egen nøgle. Nøglen ligger kun på telefonen og sendes kun til udbyderen.

- **OpenRouter (standard, billigst):** nøgle fra openrouter.ai. Standardmodellen er GLM 5.3 Flash fra Z.ai (`z-ai/glm-5.3-flash`). Man kan også skrive et andet model-ID, hvis modellen understøtter JSON-svar.
- **Anthropic Claude:** nøgle fra console.anthropic.com. Haiku 5.5 er billig, Opus 5.5 er bedst.

Z.ai's egen API kan ikke kaldes direkte fra en browser, fordi den ikke tillader det (CORS). Brug derfor GLM via OpenRouter.

Hvis Anthropics SDK skal opdateres: `npm install` og derefter `npm run build:sdk`.

## Stemmer

Stemmerne er lavet med VOICEVOX (猫使ビィ, 雨晴はう). Læs vilkårene for hver stemme på voicevox.hiroshiba.jp, før appen udgives offentligt eller tjener penge.

## Gratis dansk stemme (Piper)

Under Indstillinger → Stemmer kan man hente en gratis neural dansk stemme ([Piper](https://github.com/rhasspy/piper), stemmen `da_DK-talesyntese-medium`, MIT-licens, datasæt CC0). Den kører direkte på telefonen uden API-nøgle. Første gang hentes cirka 60 MB fra Hugging Face, derefter virker den offline. Lulu bruger den til danske forklaringer i opkaldet.

Biblioteket pakkes til `docs/vendor/piper/` med `npm run build:piper`.
