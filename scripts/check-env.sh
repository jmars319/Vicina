#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/_common.sh"

ensure_root_files

if [[ -f "${REPO_ROOT}/.env.example" ]]; then
  log ".env.example is present"
else
  fail "Missing .env.example at repo root"
fi

if [[ -f "${REPO_ROOT}/.env" ]]; then
  log ".env is present"
else
  warn ".env is not present. Copy .env.example when you are ready to configure local services."
fi

if [[ -f "${REPO_ROOT}/.env.local" ]]; then
  log ".env.local is present"
else
  log ".env.local is not present. This is expected for a fresh scaffold."
fi
