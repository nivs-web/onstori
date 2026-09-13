# PreCompact 훅: 자동 압축이 일어나면 기록만 남긴다 (자동 직원이면 어느 업무였는지 함께)
. "$PSScriptRoot/_common.ps1"
$j = Read-HookInput
$trig = ''; try { $trig = $j.trigger } catch {}
$id = if ($env:ONSTORI_TASK_ID) { $env:ONSTORI_TASK_ID } else { ([string]$j.session_id).Substring(0, 8) }
Add-Event 'context' $id 'hook' ("컨텍스트 압축 발생 ({0}) — 업무가 너무 컸을 수 있음" -f $trig)
if ($env:ONSTORI_TASK_ID) { try { Append-Utf8 (AiPath "results/$($env:ONSTORI_TASK_ID).progress.md") ("- " + (Get-Date -Format 'HH:mm') + " [시스템] 컨텍스트 자동 압축 발생`n") } catch {} }
exit 0
