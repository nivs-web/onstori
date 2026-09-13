# SessionStart 훅: 새 세션(/clear 직후 포함)에 최근 인수인계서를 자동으로 넣어 준다
. "$PSScriptRoot/_common.ps1"
if ($env:ONSTORI_ROLE) { exit 0 }   # 자동 직원은 지시서가 따로 있다
$j = Read-HookInput
$dir = AiPath 'handoffs'
if (-not (Test-Path -LiteralPath $dir)) { exit 0 }
$recent = Get-ChildItem -LiteralPath $dir -Filter '*.md' | Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-6) } | Sort-Object LastWriteTime -Descending
if (-not $recent) { exit 0 }
$latest = $recent[0]
$text = [IO.File]::ReadAllText($latest.FullName, [Text.Encoding]::UTF8)
if ($text.Length -gt 12000) { $text = $text.Substring(0, 12000) + "`n...(잘림. 전체는 파일을 읽어라)" }
$others = ($recent | Select-Object -Skip 1 -First 4 | ForEach-Object { $_.Name }) -join ', '
$ctx = "## 인수인계서 (자동 주입 · $($latest.Name))`n이전 세션이 컨텍스트가 꽉 차서 남긴 인수인계서다. 이 내용을 이어받아 진행하라. 첫 답변에서 '인수인계서 $($latest.Name) 를 읽었습니다' 라고 한 줄 밝히고, 5) '대표님이 답해야 할 것' 이 있으면 먼저 물어라.`n"
if ($others) { $ctx += "다른 최근 인수인계서: $others (네 역할과 다르면 무시)`n" }
$ctx += "`n$text"
$out = @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $ctx } }
Write-Output ($out | ConvertTo-Json -Compress -Depth 4)
exit 0
