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

Videoerne er delt i kategorier i biblioteket: **Let japansk** (`easy`), **Folkeeventyr og yōkai** (`folk`), **Anime** (`anime`) og **Drama** (`drama`).

En fast video ligger i `videos/<YouTube-id>/` som en af to slags filer:

- **`video.json`** – lavet af appens AI. Kør appen lokalt (`npm run serve`), lav videoen med »Tilføj video«, og gem den som fast video fra browserens konsol: `fetch('/api/save-video', { method: 'POST', body: localStorage.getItem('lululingo.video.<id>') })`. Tilføj `"category"` og evt. `"order"` (rækkefølge i kategorien) i filen. Gemningen virker kun fra selve computeren.
- **`script.json`** – skrevet i hånden, som `videos/qJfQyxwVIw4/script.json`. Hver replik får `start` og `end` i sekunder, `jp` med mellemrum mellem ordene, samt `da` og `en`. Ordene slås op i `episodes/lexicon.json`.

Find videoer, der må vises i andre apps (indlejring slået til) og helst har japanske undertekster lavet af en person. Kør derefter:

```powershell
node tools/build-videos.js
```

Underteksterne havner i `docs/videos/<YouTube-id>/`, og videoen kommer automatisk med i biblioteket.

Underteksterne er afskrevet fra videoernes egne japanske undertekster. Spørg kanalen om lov, før appen udgives bredt eller tjener penge.

## Egne videoer (Tilføj video)

Under **Se → Tilføj en video fra YouTube** kan man selv indsætte et YouTube-link. Appen henter videoens japanske undertekster, og AI'en (samme nøgle som chatten) deler dem op i ord med furigana, romaji og danske/engelske betydninger. Videoen gemmes kun på telefonen og kan slettes igen fra biblioteket.

Videoen skal have japanske undertekster. Dem, en person har skrevet, giver det bedste resultat. YouTubes automatiske undertekster virker også, men kan indeholde fejl.

### Sæt undertekst-tjenesten op (gratis, ca. 5 minutter)

En iPhone-app må ikke selv hente undertekster fra YouTube. Det gør en lille gratis tjeneste på din egen Cloudflare-konto (`worker/captions.mjs`):

1. Opret en gratis konto på **dash.cloudflare.com**.
2. Vælg **Workers & Pages** → **Create** → **Start with Hello World!**, giv den et navn (fx `lululingo-captions`) og tryk **Deploy**.
3. Tryk **Edit code**, slet alt i editoren, og indsæt hele indholdet af [`worker/captions.mjs`](https://raw.githubusercontent.com/evelinestricker-jpg/lululingo/main/worker/captions.mjs). Tryk **Deploy**.
4. Kopiér adressen (fx `https://lululingo-captions.ditnavn.workers.dev`), og indsæt den i appen under **Indstillinger → Egne videoer fra YouTube**. Tryk **Gem** og derefter **Test**.

YouTube blokerer nogle gange den slags tjenester. Så viser appen en besked, og man kan i stedet indsætte underteksterne selv: en SRT- eller VTT-fil, eller teksten fra YouTubes »Vis transskription« på en computer.

Når appen kører lokalt med `npm run serve`, er tjenesten indbygget (`api/captions`), så der skal ikke sættes noget op.

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
