#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
用法:
  scripts/worktree-prune.sh [--base <branch>] [--apply]

说明:
  清理已并入基线分支的分支型 worktree。
  默认只预览，不执行删除；加 --apply 后才真正移除。
EOF
}

die() {
  echo "错误: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少依赖命令: $1"
}

BASE="main"
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      shift
      [[ $# -gt 0 ]] || die "--base 需要参数"
      BASE="$1"
      ;;
    --apply)
      APPLY=1
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

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webenvoy-worktree-prune.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT

WORKTREE_FILE="${TMP_DIR}/worktrees.tsv"
MERGED_FILE="${TMP_DIR}/merged.txt"
CURRENT_BRANCH="$(git -C "${REPO_ROOT}" branch --show-current)"

git -C "${REPO_ROOT}" worktree list --porcelain | awk '
  /^worktree / {
    path=$2
    branch=""
    detached="no"
  }
  /^branch / {
    branch=$2
    sub("^refs/heads/", "", branch)
  }
  /^detached$/ {
    detached="yes"
  }
  /^$/ {
    print path "\t" branch "\t" detached
  }
' > "${WORKTREE_FILE}"

git -C "${REPO_ROOT}" branch --format='%(refname:short)' --merged "origin/${BASE}" | sed 's/^..//' | sed '/^$/d' > "${MERGED_FILE}" || true

candidates=0
while IFS=$'\t' read -r path branch detached; do
  [[ "${detached}" == "no" ]] || continue
  [[ -n "${branch}" ]] || continue
  [[ "${branch}" != "main" ]] || continue
  [[ "${branch}" != "${CURRENT_BRANCH}" ]] || continue
  if ! grep -Fxq "${branch}" "${MERGED_FILE}"; then
    continue
  fi

  candidates=$((candidates + 1))
  if [[ "${APPLY}" == "1" ]]; then
    echo "[apply] 移除 worktree: ${path} (${branch})"
    git -C "${REPO_ROOT}" worktree remove "${path}"
    if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${branch}"; then
      git -C "${REPO_ROOT}" branch -d "${branch}" || true
    fi
  else
    echo "[dry-run] 可移除 worktree: ${path} (${branch})"
  fi
done < "${WORKTREE_FILE}"

if [[ "${candidates}" -eq 0 ]]; then
  echo "没有可清理的分支型 worktree。"
fi

if [[ "${APPLY}" == "1" ]]; then
  git -C "${REPO_ROOT}" worktree prune
fi
