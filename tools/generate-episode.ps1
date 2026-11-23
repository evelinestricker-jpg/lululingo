<#
  Lululingo – laver et færdigt Lulu-afsnit (stemmer, musik, lydeffekter, undertekster og tidslinje) med VOICEVOX.

  Brug:
    1. Start VOICEVOX (programmet skal være åbent, så motoren kører på port 50021).
    2. Kør:  powershell -ExecutionPolicy Bypass -File tools\generate-episode.ps1 -Episode ep02

  Manuskript: episodes\<Episode>\script.json   Ordbog: episodes\lexicon.json
  Resultat i docs\episodes\<Episode>\ (og docs\episodes\index.json opdateres):
    episode.wav     – hele afsnittet med stemmer, musik og lydeffekter
    subtitles.json  – replikker (start/slut, ord, læsning, dansk, engelsk, mundbevægelse) og tidslinje til tegnefilmen

  Manuskriptet er en liste "lines". Hver post er enten
    en replik:  { "s": "lulu", "jp": "いちご が 好き ！", "da": "...", "en": "...", ...cue }
                (ordene adskilles med mellemrum og slås op i lexicon.json; "は@about" vælger en bestemt betydning)
    en pause:   { "beat": 2.5, ...cue }
  cue-felter styrer tegnefilmen: scene, sky, text, pos, act, hold, props, fx, cam, face – og lyden: sfx, music.
#>
param(
  [string]$Episode = "ep01",
  [string]$Engine = "http://127.0.0.1:50021",
  [double]$Speed = 0.9
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$epDir = Join-Path $root "episodes\$Episode"
$scriptPath = Join-Path $epDir "script.json"
if (-not (Test-Path $scriptPath)) { throw "Fandt ikke $scriptPath" }
$outDir = Join-Path $root "docs\episodes\$Episode"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -TypeDefinition ([System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "ToonAudio.cs")))

$utf8 = New-Object System.Text.UTF8Encoding $false
$script = [System.IO.File]::ReadAllText($scriptPath, $utf8) | ConvertFrom-Json
$lexPath = Join-Path $root "episodes\lexicon.json"
$lex = @{}
if (Test-Path $lexPath) {
  $lexJson = [System.IO.File]::ReadAllText($lexPath, $utf8) | ConvertFrom-Json
  foreach ($p in $lexJson.PSObject.Properties) { $lex[$p.Name] = $p.Value }
}

$wc = New-Object System.Net.WebClient
$wc.Encoding = $utf8
function Get-EngineJson([string]$path) { return ($wc.DownloadString("$Engine$path") | ConvertFrom-Json) }
try { $ver = $wc.DownloadString("$Engine/version") } catch { throw "VOICEVOX kører ikke. Åbn VOICEVOX-programmet og prøv igen." }
Write-Host "VOICEVOX-motor fundet (version $ver)"

# Stemmer
$speakers = Get-EngineJson "/speakers"
function Find-Style([string]$voice, [string]$style) {
  $sp = $speakers | Where-Object { $_.name -eq $voice } | Select-Object -First 1
  if (-not $sp) { throw "Stemmen '$voice' findes ikke i din VOICEVOX. Tjek navnet i script.json." }
  $st = $sp.styles | Where-Object { $_.name -eq $style } | Select-Object -First 1
  if (-not $st) { $st = $sp.styles | Select-Object -First 1 }
  return [int]$st.id
}
$voiceIds = @{}; $credits = @()
foreach ($prop in $script.characters.PSObject.Properties) {
  $c = $prop.Value
  $voiceIds[$prop.Name] = Find-Style $c.voice $c.style
  $credits += "VOICEVOX:$($c.voice)"
  Write-Host ("{0} -> {1} ({2}), id {3}" -f $c.nameDa, $c.voice, $c.style, $voiceIds[$prop.Name])
}

# Ord fra manuskriptet -> tokens med læsning og betydning
$punct = '^[。！？、…「」～!?,.\s]+$'
$missing = New-Object System.Collections.Generic.List[string]
function Get-Tokens($line) {
  if ($line.tokens) { return @($line.tokens) }
  $out = @()
  foreach ($w in ($line.jp -split '\s+' | Where-Object { $_ })) {
    if ($w -match $punct) { $out += [ordered]@{ w = $w; p = $true }; continue }
    $key = $w; $surface = ($w -split '@')[0]
    $e = $lex[$key]
    if (-not $e) { $missing.Add($key); continue }
    $t = [ordered]@{ w = $surface }
    if ($e[0]) { $t.r = $e[0] }
    $t.ro = $e[1]; $t.da = $e[2]; $t.en = $e[3]; $t.type = $e[4]; $t.lvl = $e[5]
    $out += $t
  }
  return $out
}
foreach ($line in $script.lines) { if (-not $line.beat) { [void](Get-Tokens $line) } }
if ($missing.Count) { throw ("Disse ord mangler i episodes\lexicon.json: " + (($missing | Select-Object -Unique) -join ", ")) }

function Read-Wav([byte[]]$b) {
  $pos = 12; $fmt = $null; $data = $null
  while ($pos -lt $b.Length - 8) {
    $id = [System.Text.Encoding]::ASCII.GetString($b, $pos, 4)
    $size = [BitConverter]::ToInt32($b, $pos + 4)
    if ($id -eq "fmt ") { $fmt = @{ channels = [BitConverter]::ToInt16($b, $pos + 10); rate = [BitConverter]::ToInt32($b, $pos + 12); bits = [BitConverter]::ToInt16($b, $pos + 22) } }
    elseif ($id -eq "data") { $len = [Math]::Min($size, $b.Length - $pos - 8); $data = New-Object byte[] $len; [Array]::Copy($b, $pos + 8, $data, 0, $len) }
    $pos += 8 + $size + ($size % 2)
  }
  if (-not $fmt -or -not $data) { throw "Kunne ikke læse WAV-data" }
  if ($fmt.channels -ne 1 -or $fmt.bits -ne 16) { throw "Forventede mono 16-bit lyd fra VOICEVOX" }
  $fmt.data = $data
  return $fmt
}

$cueKeys = @('scene', 'sky', 'text', 'pos', 'act', 'hold', 'props', 'fx', 'cam', 'face')
$gap = if ($script.gapSeconds) { [double]$script.gapSeconds } else { 0.5 }
$rate = 0
$chunks = New-Object System.Collections.Generic.List[object]   # @{ t; data }
$outLines = @(); $cues = @(); $sfx = @(); $music = @()
$t = 0.0; $n = 0

foreach ($line in $script.lines) {
  $segStart = $t
  # Tidslinje-cue for denne post
  $cue = [ordered]@{ t = [Math]::Round($segStart, 3) }
  $has = $false
  foreach ($k in $cueKeys) { if ($null -ne $line.$k) { $cue[$k] = $line.$k; $has = $true } }
  if ($has) { $cues += $cue }
  if ($line.sfx) { foreach ($s in @($line.sfx)) { $parts = "$s" -split '\+'; $sfx += @{ name = $parts[0]; t = $segStart + 0.05 + $(if ($parts.Count -gt 1) { [double]$parts[1] } else { 0 }) } } }
  if ($line.music) { $music += @{ style = "$($line.music)"; t = $segStart } }

  if ($line.beat) { $t += [double]$line.beat; continue }

  $n++
  $speaker = if ($line.s) { $line.s } else { $line.speaker }
  $tokens = @(Get-Tokens $line)
  $text = ($tokens | ForEach-Object { $_.w }) -join ""
  # Oplæsning: brug læsningen (kana), og udtal partiklerne は/へ rigtigt
  $ttsText = ($tokens | ForEach-Object {
      if ($_.r) { $_.r } elseif ($_.type -eq 'Partikel' -and $_.w -eq 'は') { 'わ' } elseif ($_.type -eq 'Partikel' -and $_.w -eq 'へ') { 'え' } else { $_.w }
    }) -join ""
  $sid = $voiceIds[$speaker]
  if ($line.style) { $sid = Find-Style $script.characters.$speaker.voice $line.style }
  if ($null -eq $sid) { throw "Ukendt figur '$speaker' i replik $n" }

  $pre = if ($null -ne $line.pre) { [double]$line.pre } else { $gap }
  $t += $pre

  $qText = $wc.UploadString(("$Engine/audio_query?speaker=$sid&text=" + [uri]::EscapeDataString($ttsText)), "POST", "")
  $q = $qText | ConvertFrom-Json
  $q.speedScale = if ($line.speed) { [double]$line.speed * $Speed } else { $Speed }
  $q.prePhonemeLength = 0.05; $q.postPhonemeLength = 0.08
  if ($line.pitch) { $q.pitchScale = [double]$line.pitch }
  if ($line.intonation) { $q.intonationScale = [double]$line.intonation }
  $body = $utf8.GetBytes(($q | ConvertTo-Json -Depth 20 -Compress))
  $wc.Headers["Content-Type"] = "application/json"
  $wav = Read-Wav ($wc.UploadData("$Engine/synthesis?speaker=$sid", "POST", $body))
  if (-not $rate) { $rate = $wav.rate } elseif ($wav.rate -ne $rate) { throw "Replik $n har en anden samplerate." }
  $secs = $wav.data.Length / (2 * $rate)

  $chunks.Add(@{ t = $t; data = $wav.data })
  $outLines += [ordered]@{
    n = $n; speaker = $speaker
    start = [Math]::Round($t, 3); end = [Math]::Round($t + $secs, 3)
    jp = $text; da = $line.da; en = $line.en
    m = [ToonAudio]::Mouth($wav.data, $rate)
    tokens = $tokens
  }
  Write-Host ("{0:D2}  {1,6:N2}s  {2,-6} {3}" -f $n, $secs, $speaker, $text)
  $t += $secs
  if ($line.post) { $t += [double]$line.post }
}
$t += 1.0
$total = $t

# Saml lyden: stemmer + musik + effekter
$buf = New-Object float[] ([int][Math]::Ceiling($total * $rate))
foreach ($c in $chunks) { [ToonAudio]::AddPcm($buf, $c.data, $c.t, $rate, 0.92) }
$ss = [double[]]@($outLines | ForEach-Object { $_.start }); $se = [double[]]@($outLines | ForEach-Object { $_.end })
for ($i = 0; $i -lt $music.Count; $i++) {
  $m0 = $music[$i].t; $m1 = if ($i + 1 -lt $music.Count) { $music[$i + 1].t + 0.6 } else { $total }
  [ToonAudio]::Music($buf, $rate, $music[$i].style, $m0, $m1, $ss, $se, (1000 + $i * 17 + $Episode.GetHashCode() % 1000))
}
foreach ($s in $sfx) { [ToonAudio]::Sfx($buf, $rate, $s.name, $s.t) }

$data = [ToonAudio]::FloatToPcm($buf)
$epWav = Join-Path $outDir "episode.wav"
if (Test-Path $epWav) { Remove-Item $epWav -Force }
$fs = [System.IO.File]::Create($epWav)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF")); $bw.Write([int](36 + $data.Length))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt ")); $bw.Write([int]16); $bw.Write([int16]1)
$bw.Write([int16]1); $bw.Write([int]$rate); $bw.Write([int]($rate * 2)); $bw.Write([int16]2); $bw.Write([int16]16)
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("data")); $bw.Write([int]$data.Length); $bw.Write($data)
$bw.Close()

$out = [ordered]@{
  id = $script.id; title = $script.title; titleDa = $script.titleDa; titleEn = $script.titleEn
  level = $script.level; duration = [Math]::Round($total, 3); audio = "episode.wav"
  characters = $script.characters
  credits = @($credits | Select-Object -Unique)
  cues = $cues
  lines = $outLines
}
[System.IO.File]::WriteAllText((Join-Path $outDir "subtitles.json"), ($out | ConvertTo-Json -Depth 30 -Compress), $utf8)

# Opdatér listen over afsnit, som appens bibliotek læser
$indexPath = Join-Path $root "docs\episodes\index.json"
$entries = @()
if (Test-Path $indexPath) { $entries = @(([System.IO.File]::ReadAllText($indexPath, $utf8) | ConvertFrom-Json).episodes | Where-Object { $_.id -ne $script.id }) }
$entries += [ordered]@{
  id = $script.id; title = $script.title; titleDa = $script.titleDa; titleEn = $script.titleEn
  level = $script.level; duration = [Math]::Round($total, 1); lines = $n
  cast = @($script.characters.PSObject.Properties | Where-Object { $_.Name -ne 'narrator' } | ForEach-Object { $_.Name })
}
$entries = @($entries | Sort-Object { $_.id })
[System.IO.File]::WriteAllText($indexPath, ([ordered]@{ episodes = $entries } | ConvertTo-Json -Depth 10), $utf8)

Write-Host ""
Write-Host ("Færdig! {0} replikker, {1:N0} sek. ({2:N1} min) i alt." -f $n, $total, ($total / 60))
Write-Host "Filer: $outDir"
