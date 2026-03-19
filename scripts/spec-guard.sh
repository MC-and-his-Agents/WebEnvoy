#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

die() {
  echo "错误: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少依赖命令: $1"
}

warn() {
  echo "[spec-guard] 提示: $*" >&2
}

ALLOWED_WITH_SPEC_REGEX='^(docs/dev/specs/|docs/dev/architecture/|docs/dev/AGENTS\.md|docs/AGENTS\.md|docs/research/ref/|AGENTS\.md|vision\.md|code_review\.md|spec_review\.md|scripts/|\.github/workflows/|\.githooks/|\.github/PULL_REQUEST_TEMPLATE\.md)'

resolve_base_ref() {
  if [[ -n "${SPEC_GUARD_BASE_REF:-}" ]]; then
    printf '%s\n' "${SPEC_GUARD_BASE_REF}"
    return
  fi

  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    printf '%s\n' "${GITHUB_BASE_REF}"
    return
  fi

  printf '%s\n' "origin/main"
}

ensure_ref_available() {
  local ref="$1"

  if git rev-parse --verify "${ref}" >/dev/null 2>&1; then
    return 0
  fi

  if [[ "${ref}" == origin/* ]]; then
    git fetch origin "${ref#origin/}" >/dev/null 2>&1 || true
  fi

  git rev-parse --verify "${ref}" >/dev/null 2>&1 || die "无法解析基线引用: ${ref}"
}

changed_files() {
  local base_ref="$1"
  git -C "${REPO_ROOT}" diff --name-only "${base_ref}...HEAD"
}

validate_fr_suite() {
  local fr_dir="$1"
  local plan_file="${fr_dir}/plan.md"

  [[ -f "${fr_dir}/spec.md" ]] || die "${fr_dir} 缺少 spec.md"
  [[ -f "${plan_file}" ]] || die "${fr_dir} 缺少 plan.md"
  [[ -f "${fr_dir}/TODO.md" ]] || die "${fr_dir} 缺少 TODO.md"
  [[ -s "${fr_dir}/spec.md" ]] || die "${fr_dir}/spec.md 为空"
  [[ -s "${plan_file}" ]] || die "${fr_dir}/plan.md 为空"
  [[ -s "${fr_dir}/TODO.md" ]] || die "${fr_dir}/TODO.md 为空"

  grep -Eq '^##[[:space:]]+实施目标([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 实施目标`"
  grep -Eq '^##[[:space:]]+分阶段拆分([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 分阶段拆分`"
  grep -Eq '^##[[:space:]]+实现约束([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 实现约束`"
  grep -Eq '^##[[:space:]]+测试与验证策略([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 测试与验证策略`"
  grep -Eq '^##[[:space:]]+TDD[[:space:]]+范围([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## TDD 范围`"
  grep -Eq '^##[[:space:]]+并行[[:space:]]*/[[:space:]]*串行关系([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 并行 / 串行关系`"
  grep -Eq '^##[[:space:]]+进入实现前条件([[:space:]]|$)' "${plan_file}" || die "${fr_dir}/plan.md 缺少 `## 进入实现前条件`"
}

print_suite_hints() {
  local fr_dir="$1"
  local spec_file="${fr_dir}/spec.md"
  local plan_file="${fr_dir}/plan.md"
  local contracts_dir="${fr_dir}/contracts"
  local data_model_file="${fr_dir}/data-model.md"
  local research_file="${fr_dir}/research.md"
  local risks_file="${fr_dir}/risks.md"
  local suite_text

  if ! grep -qi 'given' "${spec_file}" && ! grep -q 'GWT' "${spec_file}"; then
    warn "${spec_file} 未看到明显的 GWT 验收场景标识。"
  fi

  if ! grep -Eqi '(spec review|评审通过|审查通过)' "${plan_file}"; then
    warn "${plan_file} 未看到明显的 spec review 通过后动作说明。"
  fi

  if [[ -d "${contracts_dir}" ]]; then
    if ! find "${contracts_dir}" -type f | grep -q .; then
      warn "${contracts_dir} 存在但没有任何契约文档；不要创建空壳目录。"
    fi
  fi

  if [[ -f "${data_model_file}" ]] && [[ ! -s "${data_model_file}" ]]; then
    warn "${data_model_file} 存在但为空；按需文档不应作为占位符提交。"
  fi

  if [[ -f "${research_file}" ]] && [[ ! -s "${research_file}" ]]; then
    warn "${research_file} 存在但为空；按需文档不应作为占位符提交。"
  fi

  if [[ -f "${risks_file}" ]] && [[ ! -s "${risks_file}" ]]; then
    warn "${risks_file} 存在但为空；按需文档不应作为占位符提交。"
  fi

  suite_text="$(cat "${spec_file}" "${plan_file}")"

  if [[ ! -d "${contracts_dir}" ]] && grep -Eqi '(CLI|contract|contracts|protocol|Native Messaging|extension|payload|stdout|stderr|exit code|适配器接口|结构化返回|协议|契约|退出码|通信)' <<< "${suite_text}"; then
    warn "${fr_dir} 似乎涉及稳定接口或协议，检查是否需要补 `contracts/`。"
  fi

  if [[ ! -f "${data_model_file}" ]] && grep -Eqi '(SQLite|schema|table|migration|profile|session|run record|config|cache|entity|持久化|数据模型|表结构|迁移|身份|会话|运行记录|配置|缓存)' <<< "${suite_text}"; then
    warn "${fr_dir} 似乎涉及共享或持久化数据，检查是否需要补 `data-model.md`。"
  fi

  if [[ ! -f "${research_file}" ]] && grep -Eqi '(research|unknown|unknowns|third-party|signature|anti-detection|experiment|spike|验证|研究|未知|第三方|签名|反检测|实验|取舍)' <<< "${suite_text}"; then
    warn "${fr_dir} 似乎存在关键未知项或外部验证，检查是否需要补 `research.md`。"
  fi

  if [[ ! -f "${risks_file}" ]] && grep -Eqi '(risk|rollback|security|account|write path|delete|migration|concurr|风控|风险|回滚|安全|账号|写入|删除|迁移|并发|不可逆)' <<< "${suite_text}"; then
    warn "${fr_dir} 似乎涉及高风险链路，检查是否需要补 `risks.md`。"
  fi

  if ! grep -Eq '(并行|串行|阻塞|依赖|#?[0-9]{2,})' "${plan_file}"; then
    warn "${plan_file} 未看到明显的并行 / 串行或阻塞关系描述。"
  fi
}

main() {
  local base_ref
  local changed
  local spec_files
  local fr_dirs
  local disallowed

  require_cmd git
  require_cmd grep
  require_cmd sed
  require_cmd sort
  require_cmd find

  base_ref="$(resolve_base_ref)"
  ensure_ref_available "${base_ref}"

  changed="$(changed_files "${base_ref}")"
  if [[ -z "${changed}" ]]; then
    echo "[spec-guard] 未检测到相对 ${base_ref} 的变更，跳过。"
    exit 0
  fi

  spec_files="$(grep '^docs/dev/specs/FR-[0-9][0-9][0-9][0-9]-[^/]\+/' <<< "${changed}" || true)"
  if [[ -z "${spec_files}" ]]; then
    echo "[spec-guard] 未检测到正式 FR 规约变更，跳过。"
    exit 0
  fi

  echo "[spec-guard] 检测到正式 FR 规约变更"

  fr_dirs="$(
    sed -n 's#^\(docs/dev/specs/FR-[^/]\+\)/.*#\1#p' <<< "${spec_files}" | sort -u
  )"

  while IFS= read -r dir; do
    [[ -n "${dir}" ]] || continue
    validate_fr_suite "${REPO_ROOT}/${dir}"
    print_suite_hints "${REPO_ROOT}/${dir}"
  done <<< "${fr_dirs}"

  disallowed="$(grep -Ev "${ALLOWED_WITH_SPEC_REGEX}" <<< "${changed}" || true)"
  if [[ -n "${disallowed}" ]]; then
    echo "[spec-guard] 以下变更将正式 spec 与实现/非规约文件混在同一 PR 中：" >&2
    echo "${disallowed}" >&2
    die "正式 spec 变更必须先完成 spec review，再通过独立 PR 进入实现。"
  fi

  echo "[spec-guard] 通过"
}

main "$@"
