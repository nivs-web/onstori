# PreToolUse(Edit/Write) 훅: 자동 실행 직원만 검사. 보호 파일과 역할별 쓰기 범위.
. "$PSScriptRoot/_common.ps1"
if (-not $env:ONSTORI_ROLE) { exit 0 }
$j = Read-HookInput; if ($null -eq $j) { exit 0 }
$fp = ''; try { $fp = [string]$j.tool_input.file_path } catch {}
if (-not $fp) { try { $fp = [string]$j.tool_input.notebook_path } catch {} }
if (-not $fp) { exit 0 }
$norm = $fp.Replace('\', '/')
$aiDir = (Get-AiDir).Replace('\', '/').TrimEnd('/')
function Deny([string]$why) {
  Add-Event 'guard' $(if ($env:ONSTORI_TASK_ID) { $env:ONSTORI_TASK_ID } else { $env:ONSTORI_ROLE }) 'hook' ("쓰기 차단: {0} — {1}" -f $why, $norm)
  $o = @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = "쓰기 차단: $why ($norm). 보고서의 '남은 것'에 적고 넘어가라." } }
  Write-Output ($o | ConvertTo-Json -Compress -Depth 4); exit 0
}
# 회사 폴더 안은 모두 허용 (보고서·업무 파일)
if ($norm.StartsWith($aiDir, [StringComparison]::OrdinalIgnoreCase)) { exit 0 }
# 코드 쓰기 금지 역할
if (@('cto', 'reviewer', 'researcher', 'analyst', 'mkt-lead', 'copywriter', 'sangmu', 'vice', 'scout', 'janitor', 'chief', 'qa') -contains $env:ONSTORI_ROLE) { Deny "$($env:ONSTORI_ROLE) 는 저장소 파일을 쓰지 않는다 (회사 폴더에만 쓴다)" }
# 보호 파일 (개발자도 금지 — 대표·클코님만)
$protected = @('/\.env', '/supabase/migrations/', '/lib/schema\.ts$', '/\.github/', '/next\.config\.', '/package-lock\.json$', '/\.claude/settings', '/\.claude/hooks/', '/\.claude/agents/', '/vercel\.json$', '/middleware\.ts$', '/app/api/admin/')
foreach ($p in $protected) { if ($norm -imatch $p) { Deny "보호 파일($p)" } }
exit 0
