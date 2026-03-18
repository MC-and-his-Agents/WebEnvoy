#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
用法:
  scripts/dev-status.sh [--base <branch>]

说明:
  汇总当前仓库的活跃 worktree、开放 PR、卡住项和清理候选项。
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      shift
      [[ $# -gt 0 ]] || die "--base 需要参数"
      BASE="$1"
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

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/webenvoy-dev-status.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT

WORKTREE_FILE="${TMP_DIR}/worktrees.tsv"
PR_FILE="${TMP_DIR}/prs.json"
MERGED_FILE="${TMP_DIR}/merged.txt"

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

gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,milestone,url > "${PR_FILE}"
git -C "${REPO_ROOT}" branch --format='%(refname:short)' --merged "origin/${BASE}" | sed 's/^..//' | sed '/^$/d' > "${MERGED_FILE}" || true

CURRENT_BRANCH="$(git -C "${REPO_ROOT}" branch --show-current)"

echo "## 正在做"
awk -F '\t' '$2 != "" && $2 != "main" { print $1 "\t" $2 }' "${WORKTREE_FILE}" | while IFS=$'\t' read -r path branch; do
  [[ -n "${branch}" ]] || continue
  pr_summary="$(jq -r --arg branch "${branch}" '
    map(select(.headRefName == $branch)) | .[0] |
    if . == null then "无 PR"
    else
      "PR #" + (.number|tostring) + " · " +
      (if .isDraft then "Draft" else "Ready" end) + " · " +
      (.title)
    end
  ' "${PR_FILE}")"
  echo "- ${branch} @ ${path} · ${pr_summary}"
done

echo
echo "## 卡住"
blocked=0
jq -c '
  .[] | select(
    .isDraft == true
    or .reviewDecision == "CHANGES_REQUESTED"
    or (.mergeStateStatus != null and (.mergeStateStatus | IN("BLOCKED","DIRTY","BEHIND","UNSTABLE","UNKNOWN")))
  )
' "${PR_FILE}" | while IFS= read -r pr; do
  blocked=1
  number="$(jq -r '.number' <<< "${pr}")"
  branch="$(jq -r '.headRefName' <<< "${pr}")"
  title="$(jq -r '.title' <<< "${pr}")"
  state_bits=()
  [[ "$(jq -r '.isDraft' <<< "${pr}")" == "true" ]] && state_bits+=("Draft")
  review_decision="$(jq -r '.reviewDecision // ""' <<< "${pr}")"
  [[ -n "${review_decision}" && "${review_decision}" != "null" ]] && state_bits+=("${review_decision}")
  merge_state="$(jq -r '.mergeStateStatus // ""' <<< "${pr}")"
  [[ -n "${merge_state}" && "${merge_state}" != "null" ]] && state_bits+=("${merge_state}")
  echo "- PR #${number} (${branch}) · ${title} · ${state_bits[*]}"
done
if [[ "$(jq '[ .[] | select(.isDraft == true or .reviewDecision == "CHANGES_REQUESTED" or (.mergeStateStatus != null and (.mergeStateStatus | IN("BLOCKED","DIRTY","BEHIND","UNSTABLE","UNKNOWN")))) ] | length' "${PR_FILE}")" -eq 0 ]]; then
  echo "- 无明显卡住项"
fi

echo
echo "## 可清理"
cleanup_count=0
while IFS=$'\t' read -r path branch detached; do
  [[ "${detached}" == "no" ]] || continue
  [[ -n "${branch}" ]] || continue
  [[ "${branch}" != "main" ]] || continue
  [[ "${branch}" != "${CURRENT_BRANCH}" ]] || continue
  if grep -Fxq "${branch}" "${MERGED_FILE}"; then
    echo "- ${branch} @ ${path} · 已并入 origin/${BASE}"
    cleanup_count=$((cleanup_count + 1))
  fi
done < "${WORKTREE_FILE}"
if [[ "${cleanup_count}" -eq 0 ]]; then
  echo "- 无分支型 worktree 清理候选项"
fi

echo
echo "## 策略告警"
alerts=0
while IFS= read -r branch; do
  [[ -n "${branch}" ]] || continue
  [[ "${branch}" != "main" ]] || continue
  if ! awk -F '\t' -v target="${branch}" '$2 == target { found=1 } END { exit(found ? 0 : 1) }' "${WORKTREE_FILE}"; then
    echo "- 分支 ${branch} 没有专属 worktree"
    alerts=$((alerts + 1))
  fi
done < <(jq -r '.[].headRefName' "${PR_FILE}" | sort -u)

DETACHED_COUNT="$(awk -F '\t' '$3 == "yes" { count++ } END { print count + 0 }' "${WORKTREE_FILE}")"
if [[ "${DETACHED_COUNT}" -gt 0 ]]; then
  echo "- 检测到 ${DETACHED_COUNT} 个 detached worktree，请确认它们是否仍需保留"
  alerts=$((alerts + 1))
fi

if [[ "${alerts}" -eq 0 ]]; then
  echo "- 无策略告警"
fi
