#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MAP_FILE="${REPO_ROOT}/.github/spec-issue-sync-map.yml"
SPEC_PATH_REGEX='^docs/dev/specs/FR-[0-9][0-9][0-9][0-9]-[^/]+/spec\.md$'

die() {
  echo "错误: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少依赖命令: $1"
}

parse_map_entries() {
  awk '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ || /^[[:space:]]*mappings:[[:space:]]*$/ { next }
    /^[[:space:]]*-[[:space:]]+spec_path:[[:space:]]*/ {
      line = $0
      sub(/^[[:space:]]*-[[:space:]]+spec_path:[[:space:]]*/, "", line)
      spec_path = line
      next
    }
    /^[[:space:]]*canonical_issue_number:[[:space:]]*[0-9]+[[:space:]]*$/ {
      line = $0
      sub(/^[[:space:]]*canonical_issue_number:[[:space:]]*/, "", line)
      if (spec_path == "") {
        exit 21
      }
      print spec_path "\t" line
      spec_path = ""
      next
    }
    {
      exit 22
    }
    END {
      if (spec_path != "") {
        exit 23
      }
    }
  ' "${MAP_FILE}"
}

validate_map() {
  local entries seen_specs seen_issues spec_path issue_number

  [[ -f "${MAP_FILE}" ]] || die "缺少同步映射文件: ${MAP_FILE}"
  [[ -s "${MAP_FILE}" ]] || die "同步映射文件为空: ${MAP_FILE}"

  entries="$(parse_map_entries)" || die "同步映射文件格式无效: ${MAP_FILE}"
  [[ -n "${entries}" ]] || die "同步映射文件没有任何映射项: ${MAP_FILE}"

  seen_specs="$(mktemp "${TMPDIR:-/tmp}/webenvoy-spec-sync-map-specs.XXXXXX")"
  seen_issues="$(mktemp "${TMPDIR:-/tmp}/webenvoy-spec-sync-map-issues.XXXXXX")"
  trap 'rm -f "${seen_specs:-}" "${seen_issues:-}"' RETURN

  while IFS=$'\t' read -r spec_path issue_number; do
    [[ "${spec_path}" =~ ${SPEC_PATH_REGEX} ]] || die "映射路径不符合正式 spec 规则: ${spec_path}"
    [[ "${issue_number}" =~ ^[0-9]+$ ]] || die "canonical_issue_number 必须为数字: ${spec_path}"

    if grep -Fxq "${spec_path}" "${seen_specs}"; then
      die "重复的 spec_path 映射: ${spec_path}"
    fi
    if grep -Fxq "${issue_number}" "${seen_issues}"; then
      die "重复的 canonical_issue_number 映射: ${issue_number}"
    fi

    printf '%s\n' "${spec_path}" >> "${seen_specs}"
    printf '%s\n' "${issue_number}" >> "${seen_issues}"
  done <<< "${entries}"
}

resolve_issue_number() {
  local target="$1"

  while IFS=$'\t' read -r spec_path issue_number; do
    if [[ "${spec_path}" == "${target}" ]]; then
      printf '%s\n' "${issue_number}"
      return 0
    fi
  done < <(parse_map_entries)

  return 4
}

assert_mapped() {
  local target issue_number

  validate_map

  for target in "$@"; do
    [[ "${target}" =~ ${SPEC_PATH_REGEX} ]] || die "只允许检查正式 spec.md 路径: ${target}"
    if ! issue_number="$(resolve_issue_number "${target}")"; then
      die "缺少 spec_path -> canonical_issue_number 映射: ${target}"
    fi
    [[ "${issue_number}" =~ ^[0-9]+$ ]] || die "映射结果无效: ${target}"
  done
}

usage() {
  cat <<'EOF'
用法:
  bash scripts/spec-issue-sync-map.sh validate
  bash scripts/spec-issue-sync-map.sh resolve <spec_path>
  bash scripts/spec-issue-sync-map.sh assert-mapped <spec_path> [spec_path...]
EOF
}

main() {
  require_cmd awk
  require_cmd grep
  require_cmd mktemp

  case "${1:-}" in
    validate)
      shift
      [[ "$#" -eq 0 ]] || die "validate 不接受额外参数"
      validate_map
      ;;
    resolve)
      shift
      [[ "$#" -eq 1 ]] || die "resolve 需要 1 个 spec_path 参数"
      validate_map
      resolve_issue_number "$1" || die "缺少 spec_path -> canonical_issue_number 映射: $1"
      ;;
    assert-mapped)
      shift
      [[ "$#" -ge 1 ]] || die "assert-mapped 至少需要 1 个 spec_path"
      assert_mapped "$@"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
