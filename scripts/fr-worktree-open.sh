#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_NAME="$(basename "${REPO_ROOT}")"

usage() {
  cat <<'EOF'
用法:
  scripts/fr-worktree-open.sh --branch <name> [--base <branch>] [--path <dir>] [--issue <n>] [--fr <FR-XXXX>] [--dry-run]

说明:
  为一个活跃分支创建独立 worktree。
  main 应留在仓库主目录，不通过本脚本额外创建 worktree。
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
  echo "[fr-worktree-open] $*"
}

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

branch_exists_local() {
  git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/$1"
}

branch_exists_remote() {
  git -C "${REPO_ROOT}" ls-remote --exit-code --heads origin "$1" >/dev/null 2>&1
}

worktree_exists_for_branch() {
  git -C "${REPO_ROOT}" worktree list --porcelain | awk '
    /^worktree / { path=$2 }
    /^branch / {
      branch=$2
      sub("^refs/heads/", "", branch)
      if (branch == target) {
        print path
      }
    }
  ' target="$1"
}

BRANCH=""
BASE="main"
TARGET_PATH=""
ISSUE=""
FR_ID=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      shift
      [[ $# -gt 0 ]] || die "--branch 需要参数"
      BRANCH="$1"
      ;;
    --base)
      shift
      [[ $# -gt 0 ]] || die "--base 需要参数"
      BASE="$1"
      ;;
    --path)
      shift
      [[ $# -gt 0 ]] || die "--path 需要参数"
      TARGET_PATH="$1"
      ;;
    --issue)
      shift
      [[ $# -gt 0 ]] || die "--issue 需要参数"
      ISSUE="$1"
      ;;
    --fr)
      shift
      [[ $# -gt 0 ]] || die "--fr 需要参数"
      FR_ID="$1"
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

[[ -n "${BRANCH}" ]] || die "必须提供 --branch"
[[ "${BRANCH}" != "main" ]] || die "main 应留在仓库主目录，不通过本脚本创建额外 worktree"

DEFAULT_ROOT="${WEBENVOY_WORKTREE_ROOT:-${HOME}/.codex/worktrees}"
BRANCH_SLUG="${BRANCH//\//-}"
TARGET_PATH="${TARGET_PATH:-${DEFAULT_ROOT}/${REPO_NAME}/${BRANCH_SLUG}}"

EXISTING_PATH="$(worktree_exists_for_branch "${BRANCH}" | head -n 1 || true)"
[[ -z "${EXISTING_PATH}" ]] || die "分支 ${BRANCH} 已绑定 worktree: ${EXISTING_PATH}"

if [[ -e "${TARGET_PATH}" ]]; then
  die "目标路径已存在: ${TARGET_PATH}"
fi

START_REF=""
if branch_exists_local "${BRANCH}"; then
  START_REF="${BRANCH}"
elif branch_exists_remote "${BRANCH}"; then
  START_REF="origin/${BRANCH}"
else
  if branch_exists_remote "${BASE}"; then
    START_REF="origin/${BASE}"
  elif branch_exists_local "${BASE}"; then
    START_REF="${BASE}"
  else
    die "找不到基线分支: ${BASE}"
  fi
fi

log "仓库: ${REPO_ROOT}"
log "目标分支: ${BRANCH}"
log "基线分支: ${BASE}"
log "worktree: ${TARGET_PATH}"
[[ -n "${ISSUE}" ]] && log "关联 Issue: #${ISSUE}"
[[ -n "${FR_ID}" ]] && log "关联 FR: ${FR_ID}"

run_cmd mkdir -p "$(dirname "${TARGET_PATH}")"

if branch_exists_local "${BRANCH}"; then
  run_cmd git -C "${REPO_ROOT}" worktree add "${TARGET_PATH}" "${BRANCH}"
elif branch_exists_remote "${BRANCH}"; then
  run_cmd git -C "${REPO_ROOT}" branch --track "${BRANCH}" "origin/${BRANCH}"
  run_cmd git -C "${REPO_ROOT}" worktree add "${TARGET_PATH}" "${BRANCH}"
else
  run_cmd git -C "${REPO_ROOT}" branch "${BRANCH}" "${START_REF}"
  run_cmd git -C "${REPO_ROOT}" worktree add "${TARGET_PATH}" "${BRANCH}"
fi

log "已为分支 ${BRANCH} 预留独立 worktree。"
log "下一步可进入 ${TARGET_PATH} 开始工作。"
