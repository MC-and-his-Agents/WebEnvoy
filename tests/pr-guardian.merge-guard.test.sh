#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE_DIR="${SCRIPT_DIR}/pr-guardian.merge-guard"
export WEBENVOY_MERGE_GUARD_TEST_REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=/dev/null
source "${SUITE_DIR}/lib.sh"
# shellcheck source=/dev/null
source "${SUITE_DIR}/context-cases.sh"
# shellcheck source=/dev/null
source "${SUITE_DIR}/review-context-cases.sh"
# shellcheck source=/dev/null
source "${SUITE_DIR}/normalize-cases.sh"
# shellcheck source=/dev/null
source "${SUITE_DIR}/merge-hydrate-cases.sh"
# shellcheck source=/dev/null
source "${SUITE_DIR}/main.sh"

main "$@"
