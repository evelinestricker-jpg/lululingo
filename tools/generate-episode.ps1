<#
  Lululingo – laver stemmer og undertekster til et Lulu-afsnit med VOICEVOX.

  Brug:
    1. Start VOICEVOX (programmet skal være åbent, så motoren kører på port 50021).
    2. Kør:  powershell -ExecutionPolicy Bypass -File tools\generate-episode.ps1 -Episode ep01

  Manuskript: episodes\<Episode>\script.json
  Resultat i app\episodes\<Episode>\ (og app\episodes\index.json opdateres):
    lines\01.wav, 02.wav ...  – én lydfil pr. replik
    episode.wav               – hele afsnittet samlet, med små pauser
    subtitles.json            – replikker med start/slut-tid, ord, læsning, dansk og engelsk
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
# Færdige filer lægges i app-mappen, så web-appen kan bruge dem direkte
$outDir = Join-Path $root "app\episodes\$Episode"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding $false
$script = [System.IO.File]::ReadAllText($scriptPath, $utf8) | ConvertFrom-Json

# WebClient med UTF-8, så japansk tekst fra motoren læses rigtigt (Invoke-RestMethod i PowerShell 5.1 gør det forkert)
$wc = New-Object System.Net.WebClient
$wc.Encoding = $utf8
function Get-EngineJson([string]$path) { return ($wc.DownloadString("$Engine$path") | ConvertFrom-Json) }

try { $ver = $wc.DownloadString("$Engine/version") }
catch { throw "VOICEVOX kører ikke. Åbn VOICEVOX-programmet og prøv igen." }
Write-Host "VOICEVOX-motor fundet (version $ver)"

# Find stemme-id for hver figur ud fra navn og stil
$speakers = Get-EngineJson "/speakers"
$voiceIds = @{}
$credits = @()
foreach ($prop in $script.characters.PSObject.Properties) {
  $c = $prop.Value
  $sp = $speakers | Where-Object { $_.name -eq $c.voice } | Select-Object -First 1
  if (-not $sp) { throw "Stemmen '$($c.voice)' findes ikke i din VOICEVOX. Tjek navnet i script.json." }
  $st = $sp.styles | Where-Object { $_.name -eq $c.style } | Select-Object -First 1
  if (-not $st) { $st = $sp.styles | Select-Object -First 1 }
  $voiceIds[$prop.Name] = [int]$st.id
  $credits += "VOICEVOX:$($c.voice)"
  Write-Host ("{0} -> {1} ({2}), id {3}" -f $c.nameDa, $c.voice, $st.name, $st.id)
}

function Read-Wav([string]$path) {
  $b = [System.IO.File]::ReadAllBytes($path)
  $pos = 12; $fmt = $null; $data = $null
  while ($pos -lt $b.Length - 8) {
    $id = [System.Text.Encoding]::ASCII.GetString($b, $pos, 4)
    $size = [BitConverter]::ToInt32($b, $pos + 4)
    if ($id -eq "fmt ") {
      $fmt = @{
        channels = [BitConverter]::ToInt16($b, $pos + 10)
        rate     = [BitConverter]::ToInt32($b, $pos + 12)
        bits     = [BitConverter]::ToInt16($b, $pos + 22)
      }
    } elseif ($id -eq "data") {
      $len = [Math]::Min($size, $b.Length - $pos - 8)
      $data = New-Object byte[] $len
      [Array]::Copy($b, $pos + 8, $data, 0, $len)
    }
    $pos += 8 + $size + ($size % 2)
  }
  if (-not $fmt -or -not $data) { throw "Kunne ikke læse WAV-filen $path" }
  $fmt.data = $data
  $fmt.bytesPerSec = $fmt.rate * $fmt.channels * ($fmt.bits / 8)
  $fmt.seconds = $data.Length / $fmt.bytesPerSec
  return $fmt
}

$linesDir = Join-Path $outDir "lines"
New-Item -ItemType Directory -Force -Path $linesDir | Out-Null

$outLines = @()
$pcm = New-Object System.IO.MemoryStream
$format = $null
$t = 0.0
$i = 0
foreach ($line in $script.lines) {
  $i++
  $num = "{0:D2}" -f $i
  $tokens = @($line.tokens)
  $text = ($tokens | ForEach-Object { $_.w }) -join ""
  # Til oplæsning bruges læsningen (kana), så kanji altid udtales rigtigt
  $ttsText = ($tokens | ForEach-Object { if ($_.r) { $_.r } else { $_.w } }) -join ""
  $sid = $voiceIds[$line.speaker]

  $qText = $wc.UploadString(("$Engine/audio_query?speaker=$sid&text=" + [uri]::EscapeDataString($ttsText)), "POST", "")
  $q = $qText | ConvertFrom-Json
  $q.speedScale = $Speed
  $body = $utf8.GetBytes(($q | ConvertTo-Json -Depth 20 -Compress))
  $wavPath = Join-Path $linesDir "$num.wav"
  $wc.Headers["Content-Type"] = "application/json"
  $wav = $wc.UploadData("$Engine/synthesis?speaker=$sid", "POST", $body)
  [System.IO.File]::WriteAllBytes($wavPath, $wav)

  $w = Read-Wav $wavPath
  if (-not $format) { $format = $w }
  elseif ($w.rate -ne $format.rate -or $w.channels -ne $format.channels -or $w.bits -ne $format.bits) {
    throw "Replik $num har et andet lydformat end de andre."
  }

  $start = $t
  $pcm.Write($w.data, 0, $w.data.Length)
  $t += $w.seconds
  $end = $t
  $gapBytes = [int]([Math]::Round($script.gapSeconds * $format.rate)) * $format.channels * ($format.bits / 8)
  $pcm.Write((New-Object byte[] $gapBytes), 0, $gapBytes)
  $t += $gapBytes / $format.bytesPerSec

  $outLines += [ordered]@{
    n       = $i
    speaker = $line.speaker
    start   = [Math]::Round($start, 3)
    end     = [Math]::Round($end, 3)
    audio   = "lines/$num.wav"
    jp      = $text
    da      = $line.da
    en      = $line.en
    tokens  = $tokens
  }
  Write-Host ("{0}  {1,6:N2}s  {2}" -f $num, $w.seconds, $text)
}

# Saml hele afsnittet i én WAV-fil
$data = $pcm.ToArray()
$epWav = Join-Path $outDir "episode.wav"
$fs = [System.IO.File]::Create($epWav)
$bw = New-Object System.IO.BinaryWriter $fs
$blockAlign = [int16]($format.channels * $format.bits / 8)
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF")); $bw.Write([int](36 + $data.Length))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt ")); $bw.Write([int]16); $bw.Write([int16]1)
$bw.Write([int16]$format.channels); $bw.Write([int]$format.rate); $bw.Write([int]$format.bytesPerSec)
$bw.Write($blockAlign); $bw.Write([int16]$format.bits)
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("data")); $bw.Write([int]$data.Length); $bw.Write($data)
$bw.Close()

$out = [ordered]@{
  id         = $script.id
  title      = $script.title
  titleDa    = $script.titleDa
  titleEn    = $script.titleEn
  level      = $script.level
  duration   = [Math]::Round($t, 3)
  audio      = "episode.wav"
  characters = $script.characters
  credits    = @($credits | Select-Object -Unique)
  lines      = $outLines
}
$json = $out | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText((Join-Path $outDir "subtitles.json"), $json, $utf8)

# Opdatér listen over afsnit, som appens bibliotek læser
$indexPath = Join-Path $root "app\episodes\index.json"
$entries = @()
if (Test-Path $indexPath) {
  $entries = @(([System.IO.File]::ReadAllText($indexPath, $utf8) | ConvertFrom-Json).episodes | Where-Object { $_.id -ne $script.id })
}
$entries += [ordered]@{
  id = $script.id; title = $script.title; titleDa = $script.titleDa; titleEn = $script.titleEn
  level = $script.level; duration = [Math]::Round($t, 1); lines = $i
  cast = @($script.characters.PSObject.Properties | ForEach-Object { $_.Name })
}
$entries = @($entries | Sort-Object { $_.id })
$index = [ordered]@{ episodes = $entries } | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($indexPath, $index, $utf8)

Write-Host ""
Write-Host ("Færdig! {0} replikker, {1:N1} sekunder i alt." -f $i, $t)
Write-Host "Filer: $outDir"
