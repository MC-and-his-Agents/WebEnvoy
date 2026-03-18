#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
用法:
  scripts/fr-pr-open.sh --issue <n> [--base <branch>] [--milestone <name>] [--title <title>] [--body-file <file>] [--ready] [--dry-run]

说明:
  从当前 worktree 所在分支创建或更新 PR。
  默认创建 / 保持 Draft PR，并自动写入 Fixes #<issue>。
EOF
}

die() {
  echo "错误: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少依赖命令: $1"
}

log() {
  echo "[fr-pr-open] $*"
}

ISSUE=""
BASE="main"
MILESTONE=""
TITLE=""
BODY_FILE=""
READY=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      shift
      [[ $# -gt 0 ]] || die "--issue 需要参数"
      ISSUE="$1"
      ;;
    --base)
      shift
      [[ $# -gt 0 ]] || die "--base 需要参数"
      BASE="$1"
      ;;
    --milestone)
      shift
      [[ $# -gt 0 ]] || die "--milestone 需要参数"
      MILESTONE="$1"
      ;;
    --title)
      shift
      [[ $# -gt 0 ]] || die "--title 需要参数"
      TITLE="$1"
      ;;
    --body-file)
      shift
      [[ $# -gt 0 ]] || die "--body-file 需要参数"
      BODY_FILE="$1"
      ;;
    --ready)
      READY=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
  shift
done

require_cmd git
require_cmd gh
require_cmd jq

[[ -n "${ISSUE}" ]] || die "必须提供 --issue"

BRANCH="$(git -C "${REPO_ROOT}" branch --show-current)"
[[ -n "${BRANCH}" ]] || die "当前不在具名分支上"
[[ "${BRANCH}" != "main" ]] || die "请勿直接从 main 创建 PR"

ISSUE_JSON="$(gh issue view "${ISSUE}" --json number,title,milestone,url)"
ISSUE_TITLE="$(jq -r '.title' <<< "${ISSUE_JSON}")"
ISSUE_URL="$(jq -r '.url' <<< "${ISSUE_JSON}")"
ISSUE_MILESTONE="$(jq -r '.milestone.title // ""' <<< "${ISSUE_JSON}")"

if [[ -z "${TITLE}" ]]; then
  TITLE="${ISSUE_TITLE}"
fi

if [[ -z "${MILESTONE}" ]]; then
  MILESTONE="${ISSUE_MILESTONE}"
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webenvoy-fr-pr-open.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT
TMP_BODY="${TMP_DIR}/body.md"

if [[ -n "${BODY_FILE}" ]]; then
  cp "${BODY_FILE}" "${TMP_BODY}"
else
  cat > "${TMP_BODY}" <<EOF
Fixes #${ISSUE}

## 背景
- 来源 Issue: [#${ISSUE}](${ISSUE_URL})

## 变更摘要
- 待补充

## 验证
- 待补充
EOF
fi

if ! git -C "${REPO_ROOT}" ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "[dry-run] git push -u origin ${BRANCH}"
  else
    git -C "${REPO_ROOT}" push -u origin "${BRANCH}"
  fi
fi

EXISTING_PR="$(gh pr list --state open --head "${BRANCH}" --json number,url,isDraft | jq '.[0] // empty')"

log "当前分支: ${BRANCH}"
log "关联 Issue: #${ISSUE}"
[[ -n "${MILESTONE}" ]] && log "目标里程碑: ${MILESTONE}"

if [[ "${DRY_RUN}" == "1" ]]; then
  if [[ -n "${EXISTING_PR}" ]]; then
    log "[dry-run] 将更新现有 PR: $(jq -r '.url' <<< "${EXISTING_PR}")"
  else
    log "[dry-run] 将创建新的 PR，base=${BASE}, draft=$([[ "${READY}" == "1" ]] && echo "false" || echo "true")"
  fi
  exit 0
fi

if [[ -n "${EXISTING_PR}" ]]; then
  gh pr edit "${BRANCH}" --title "${TITLE}" --body-file "${TMP_BODY}"
  if [[ -n "${MILESTONE}" ]]; then
    gh pr edit "${BRANCH}" --milestone "${MILESTONE}"
  fi
  if [[ "${READY}" == "1" ]] && [[ "$(jq -r '.isDraft' <<< "${EXISTING_PR}")" == "true" ]]; then
    gh pr ready "${BRANCH}"
  fi
  log "已更新 PR: $(jq -r '.url' <<< "${EXISTING_PR}")"
else
  CREATE_ARGS=(pr create --base "${BASE}" --head "${BRANCH}" --title "${TITLE}" --body-file "${TMP_BODY}")
  if [[ -n "${MILESTONE}" ]]; then
    CREATE_ARGS+=(--milestone "${MILESTONE}")
  fi
  if [[ "${READY}" != "1" ]]; then
    CREATE_ARGS+=(--draft)
  fi
  gh "${CREATE_ARGS[@]}"
  log "已创建 PR。"
fi
