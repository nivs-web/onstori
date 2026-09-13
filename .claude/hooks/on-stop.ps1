# Stop 훅: 대화형 세션의 컨텍스트가 임계값(기본 80%)을 넘으면
#   1회차: 멈추지 못하게 막고(block) 인수인계서를 쓰게 한다
#   2회차: 인수인계서가 있으면 "/clear 하세요" 안내만 하고 통과
# 자동 실행 직원(ONSTORI_ROLE 있음)은 매 업무가 새 프로세스라 해당 없음 → 그냥 통과
. "$PSScriptRoot/_common.ps1"
if ($env:ONSTORI_ROLE) { exit 0 }
$j = Read-HookInput; if ($null -eq $j) { exit 0 }
$sid = [string]$j.session_id; if (-not $sid) { exit 0 }
$ctxFile = AiPath "state/ctx/$sid.json"
if (-not (Test-Path -LiteralPath $ctxFile)) { exit 0 }
$pct = 0; try { $pct = [int](Get-Content -Raw -Encoding UTF8 $ctxFile | ConvertFrom-Json).pct } catch {}
$limit = Get-ResetPct
if ($pct -lt $limit) { exit 0 }
$marker = AiPath "state/handoff-asked/$sid.txt"
$short = $sid.Substring(0, [math]::Min(8, $sid.Length))
$handoff = AiPath ("handoffs/" + (Get-Date -Format 'yyyy-MM-dd-HHmm') + "-$short.md")
if (-not (Test-Path -LiteralPath $marker)) {
  Write-Utf8 $marker $handoff
  Add-Event 'context' $short 'hook' "컨텍스트 ${pct}% → 인수인계서 요청"
  $reason = "컨텍스트가 ${pct}% 로 임계값(${limit}%)을 넘었다. 지금 다른 일을 멈추고 인수인계서를 파일로 써라: 경로 $handoff . 내용(마크다운): 1) 내 역할과 지금 대화의 목표 2) 결정된 것 3) 진행 중이던 일과 정확히 어디까지 했는지(파일·행) 4) 다음에 바로 이어서 할 일 순서 5) 대표님이 답해야 할 것 6) 주의(실패했던 시도, 하면 안 되는 것). 파일을 쓴 뒤 마지막 줄에 '인수인계서 저장 완료. /clear 를 입력하시면 새 세션이 자동으로 이어받습니다.' 라고 답하고 멈춰라."
  $out = @{ hookSpecificOutput = @{ hookEventName = 'Stop'; decision = 'block'; reason = $reason } }
  Write-Output ($out | ConvertTo-Json -Compress -Depth 4)
  exit 0
}
$out = @{ systemMessage = "⚠ 컨텍스트 ${pct}%. 인수인계서가 준비되어 있습니다. /clear 를 입력하세요 — 새 세션이 시작될 때 자동으로 읽어 이어갑니다." }
Write-Output ($out | ConvertTo-Json -Compress)
exit 0
