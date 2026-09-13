# 상태줄: 컨텍스트 % 를 화면에 보여주고, 같은 값을 회사 폴더 state/ctx/<세션>.json 에 기록한다 (대시보드·Stop 훅이 읽는다)
. "$PSScriptRoot/_common.ps1"
$j = Read-HookInput; if ($null -eq $j) { exit 0 }
$pct = 0; try { if ($null -ne $j.context_window.used_percentage) { $pct = [math]::Round([double]$j.context_window.used_percentage) } } catch {}
$model = ''; try { $model = $j.model.display_name } catch {}
$sid = ''; try { $sid = $j.session_id } catch {}
$name = ''; try { $name = $j.session_name } catch {}
$rl = $null; try { $rl = $j.rate_limits } catch {}
if ($sid -and -not $env:ONSTORI_ROLE) {
  $rec = [ordered]@{ session_id = $sid; session_name = $name; model = $model; pct = $pct; cwd = $j.cwd; role = $(if ($name) { $name } else { 'interactive' }); ts = (Get-Date).ToUniversalTime().ToString('o') }
  if ($rl) { $rec.rate_limits = $rl }
  try { Write-Utf8 (AiPath "state/ctx/$sid.json") ($rec | ConvertTo-Json -Depth 5) } catch {}
}
$limit = Get-ResetPct
$bar = ('▓' * [math]::Floor($pct / 10)) + ('░' * (10 - [math]::Floor($pct / 10)))
$warn = if ($pct -ge $limit) { '  ⚠ 인수인계 후 /clear' } elseif ($pct -ge ($limit - 15)) { '  (곧 리셋)' } else { '' }
$rlTxt = ''
if ($rl) { try { $rlTxt = ('  5h {0}% · 7d {1}%' -f [math]::Round([double]$rl.five_hour.used_percentage), [math]::Round([double]$rl.seven_day.used_percentage)) } catch {} }
Write-Output ("[{0}] {1} {2}%{3}{4}" -f $model, $bar, $pct, $warn, $rlTxt)
