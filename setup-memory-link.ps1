# Claude Code 메모리 폴더를 저장소로 연결하는 셋업 스크립트
#
# 목적: Claude Code는 메모리를 ~/.claude/projects/<경로해시>/memory 에 저장합니다.
#       이 스크립트는 그 경로를 저장소 안의 memory\ 폴더로 디렉터리 정션 연결해,
#       메모리가 git으로 컴퓨터 간 동기화되도록 합니다.
#
# 사용법: 저장소를 새 컴퓨터에 clone한 뒤 저장소 루트에서 한 번 실행:
#   powershell -ExecutionPolicy Bypass -File .\setup-memory-link.ps1
#
# 참고: 정션 자체는 git에 커밋되지 않으므로(로컬 OS 링크) 컴퓨터마다 한 번씩 실행해야 합니다.
#       메모리 "내용"은 저장소 안 memory\ 폴더에 들어 있어 git으로 따라옵니다.

$ErrorActionPreference = "Stop"

# 저장소 루트 = 이 스크립트가 있는 폴더
$repoRoot = $PSScriptRoot
$target   = Join-Path $repoRoot "memory"

# Claude Code의 프로젝트 폴더 이름 규칙: 절대경로의 드라이브 콜론과 경로 구분자를 '-'로 치환
#   예) C:\Users\doing\yflifecycle  ->  C--Users-doing-yflifecycle
$projectKey = ($repoRoot -replace '[:\\/]', '-')
$link = Join-Path $env:USERPROFILE ".claude\projects\$projectKey\memory"

Write-Host "저장소 메모리 폴더(target): $target"
Write-Host "Claude 메모리 경로(link)  : $link"

if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Path $target | Out-Null
    Write-Host "저장소 memory\ 폴더를 새로 만들었습니다."
}

# link의 부모 폴더 보장
$linkParent = Split-Path $link -Parent
if (-not (Test-Path $linkParent)) {
    New-Item -ItemType Directory -Path $linkParent -Force | Out-Null
    Write-Host "프로젝트 폴더를 새로 만들었습니다: $linkParent"
}

if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq "Junction") {
        Write-Host "이미 정션이 연결되어 있습니다 -> $($item.Target)"
    } else {
        Write-Warning "경로가 정션이 아닌 실제 폴더/파일로 존재합니다: $link"
        Write-Warning "내용을 확인 후 옮기거나 삭제한 뒤 다시 실행하세요."
        exit 1
    }
} else {
    New-Item -ItemType Junction -Path $link -Target $target | Out-Null
    Write-Host "정션을 만들었습니다: $link -> $target"
}

Write-Host "완료."
