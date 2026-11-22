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

## Lav et nyt Lulu-afsnit

1. Kopiér `episodes/ep01/script.json` til fx `episodes/ep02/script.json`, og skriv det nye manuskript.
2. Start VOICEVOX-motoren (VOICEVOX-programmet, eller `vv-engine\run.exe`).
3. Kør:

```powershell
powershell -ExecutionPolicy Bypass -File tools\generate-episode.ps1 -Episode ep02
```

Lyd og undertekster havner i `docs/episodes/ep02/`, og afsnittet kommer automatisk med i biblioteket.

## AI-chatten

Under Indstillinger vælger man AI-udbyder og indsætter sin egen nøgle. Nøglen ligger kun på telefonen og sendes kun til udbyderen.

- **OpenRouter (standard, billigst):** nøgle fra openrouter.ai. Standardmodellen er GLM 5.3 Flash fra Z.ai (`z-ai/glm-5.3-flash`). Man kan også skrive et andet model-ID, hvis modellen understøtter JSON-svar.
- **Anthropic Claude:** nøgle fra console.anthropic.com. Haiku 5.5 er billig, Opus 5.5 er bedst.

Z.ai's egen API kan ikke kaldes direkte fra en browser, fordi den ikke tillader det (CORS). Brug derfor GLM via OpenRouter.

Hvis Anthropics SDK skal opdateres: `npm install` og derefter `npm run build:sdk`.

## Stemmer

Stemmerne er lavet med VOICEVOX (猫使ビィ, 雨晴はう). Læs vilkårene for hver stemme på voicevox.hiroshiba.jp, før appen udgives offentligt eller tjener penge.
