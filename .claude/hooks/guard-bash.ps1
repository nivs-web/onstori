# PreToolUse(Bash) 훅: 자동 실행 직원(ONSTORI_ROLE 있음)만 검사. 사람 세션(클코님)은 그대로 통과.
. "$PSScriptRoot/_common.ps1"
if (-not $env:ONSTORI_ROLE) { exit 0 }
$j = Read-HookInput; if ($null -eq $j) { exit 0 }
$cmd = ''; try { $cmd = [string]$j.tool_input.command } catch {}
if (-not $cmd) { exit 0 }
function Deny([string]$why) {
  Add-Event 'guard' $(if ($env:ONSTORI_TASK_ID) { $env:ONSTORI_TASK_ID } else { $env:ONSTORI_ROLE }) 'hook' ("차단: {0} — {1}" -f $why, $cmd.Substring(0, [math]::Min(120, $cmd.Length)))
  $o = @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = "차단됨(권한 레벨): $why. 이 작업은 대표/클코님만 한다. 보고서의 '남은 것'에 적고 넘어가라." } }
  Write-Output ($o | ConvertTo-Json -Compress -Depth 4); exit 0
}
# 레벨 5 (돈·배포·삭제·외부 발송·비밀) — 모든 자동 직원 금지
$always = @(
  'git\s+push', 'git\s+reset\s+--hard', 'git\s+checkout\s+(main|master)\b', 'git\s+switch\s+(main|master)\b', 'git\s+branch\s+-D', 'git\s+clean\s+-f', 'git\s+rebase',
  '\brm\s+-r', 'Remove-Item[^|]*-Recurse', '\brmdir\s+/s', '\bdel\s+/[sq]', 'format\s+[a-z]:',
  'supabase\s+(db|functions|secrets)\s+(push|deploy|reset|set)', '\bvercel\b', 'npm\s+publish', 'prisma\s+migrate\s+deploy', 'drizzle-kit\s+push',
  'drop\s+(table|schema|database)', 'truncate\s+table', 'delete\s+from',
  'curl[^|]*-X\s*(POST|PUT|DELETE|PATCH)', 'Invoke-(WebRequest|RestMethod)[^|]*-Method\s*(Post|Put|Delete|Patch)', 'sendmail|solapi|resend\.com', '\.env(\.|\s|$)', 'cat\s+.*secret', 'setx\s'
)
foreach ($p in $always) { if ($cmd -imatch $p) { Deny "레벨5 금지 명령($p)" } }
# CTO·리뷰어·조사·그로스는 코드 쓰기 금지 → git 은 읽기 명령만, npm 은 리뷰어의 build/test 만
$readOnlyRoles = @('cto', 'reviewer', 'researcher', 'analyst', 'mkt-lead', 'copywriter', 'sangmu', 'vice', 'scout', 'janitor', 'chief', 'qa')
if ($readOnlyRoles -contains $env:ONSTORI_ROLE) {
  if ($cmd -imatch 'git\s+(add|commit|merge|stash|apply|cherry-pick|mv|rm|worktree\s+(add|remove))') { Deny "$($env:ONSTORI_ROLE) 는 git 쓰기 불가" }
  if ($env:ONSTORI_ROLE -ne 'reviewer' -and $cmd -imatch '\b(npm|npx|pnpm|yarn)\s+(?!run\s+(lint|typecheck|test|build)\b|test\b|ls\b|view\b)') { Deny "$($env:ONSTORI_ROLE) 는 npm 실행 불가" }
}
exit 0
