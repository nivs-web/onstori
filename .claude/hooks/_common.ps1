# 훅 공용: stdin JSON 읽기, 회사 폴더 찾기, UTF-8
try { [Console]::InputEncoding = [Text.Encoding]::UTF8; [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Read-HookInput { $raw = [Console]::In.ReadToEnd(); if (-not $raw) { return $null }; try { return ($raw | ConvertFrom-Json) } catch { return $null } }
function Get-AiDir {
  if ($env:ONSTORI_AI_DIR) { return $env:ONSTORI_AI_DIR }
  $fixed = 'C:/Users/ariancepc/Desktop/cowork/fable51plandept/ai-company'
  if (Test-Path -LiteralPath $fixed) { return $fixed }
  $proj = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }
  return (Join-Path (Split-Path -Parent $proj) 'ai-company')
}
function AiPath([string]$rel) { return (Join-Path (Get-AiDir) $rel) }
function Write-Utf8([string]$path, [string]$text) { $d = Split-Path -Parent $path; if ($d -and -not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }; [IO.File]::WriteAllText($path, $text, $script:Utf8NoBom) }
function Append-Utf8([string]$path, [string]$text) { $d = Split-Path -Parent $path; if ($d -and -not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }; [IO.File]::AppendAllText($path, $text, $script:Utf8NoBom) }
function Add-Event([string]$type, [string]$id, [string]$actor, [string]$msg) {
  $o = [ordered]@{ ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); type = $type; id = $id; actor = $actor; msg = $msg }
  try { Append-Utf8 (AiPath 'events.jsonl') (($o | ConvertTo-Json -Compress) + "`n") } catch {}
}
function Get-ResetPct { try { $cfg = Get-Content -Raw -Encoding UTF8 (AiPath 'config.json') | ConvertFrom-Json; return [int]$cfg.dispatcher.contextResetPct } catch { return 80 } }
