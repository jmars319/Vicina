#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

DEV_DIR="${DEV_DIR:-${REPO_ROOT}/.dev}"
DEV_CONFIG_FILE="${DEV_CONFIG_FILE:-${DEV_DIR}/dev-config.sh}"

if [[ -f "${DEV_CONFIG_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${DEV_CONFIG_FILE}"
fi

DEV_DIR="${DEV_DIR:-${REPO_ROOT}/.dev}"
DEV_PID_DIR="${DEV_PID_DIR:-${DEV_DIR}/pids}"
DEV_LOG_DIR="${DEV_LOG_DIR:-${DEV_DIR}/logs}"

DEV_WEB_HOST="${DEV_WEB_HOST:-127.0.0.1}"
DEV_WEB_PUBLIC_HOST="${DEV_WEB_PUBLIC_HOST:-localhost}"
DEV_WEB_PORT="${DEV_WEB_PORT:-3002}"
DEV_WEB_DIR="${DEV_WEB_DIR:-apps/webapp}"
DEV_WEB_HEALTH_PATH="${DEV_WEB_HEALTH_PATH:-/api/health}"
DEV_READY_TIMEOUT_SECONDS="${DEV_READY_TIMEOUT_SECONDS:-45}"
DEV_STOP_TIMEOUT_SECONDS="${DEV_STOP_TIMEOUT_SECONDS:-10}"

dev_ensure_dirs() {
  mkdir -p "${DEV_PID_DIR}" "${DEV_LOG_DIR}"
}

dev_abs_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s/%s\n' "${REPO_ROOT}" "$1" ;;
  esac
}

dev_normalize_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '/%s\n' "$1" ;;
  esac
}

dev_web_url() {
  local path
  path="$(dev_normalize_path "${1:-/}")"
  printf 'http://%s:%s%s\n' "${DEV_WEB_PUBLIC_HOST}" "${DEV_WEB_PORT}" "${path}"
}

dev_web_health_url() {
  dev_web_url "${DEV_WEB_HEALTH_PATH}"
}

dev_pid_file() {
  printf '%s/%s.pid\n' "${DEV_PID_DIR}" "$1"
}

dev_log_file() {
  printf '%s/%s.log\n' "${DEV_LOG_DIR}" "$1"
}

dev_read_pid() {
  local file="$1"
  local pid

  [[ -f "${file}" ]] || return 1
  pid="$(tr -d '[:space:]' < "${file}")"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "${pid}"
}

dev_pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

dev_port_listening() {
  local port="$1"

  if have_cmd lsof; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if have_cmd nc; then
    nc -z 127.0.0.1 "${port}" >/dev/null 2>&1
    return $?
  fi

  return 1
}

dev_port_listener() {
  local port="$1"

  if have_cmd lsof; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | awk 'NR == 2 { print $1 " pid=" $2 }'
  fi
}

dev_wait_for_url() {
  local url="$1"
  local label="$2"
  local elapsed=0

  while [[ "${elapsed}" -lt "${DEV_READY_TIMEOUT_SECONDS}" ]]; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  log_warn "${label} did not become ready after ${DEV_READY_TIMEOUT_SECONDS}s (${url})"
  return 1
}

dev_check_url() {
  local label="$1"
  local url="$2"

  log_step "${label}"
  curl -fsS "${url}" >/dev/null || fail "${label} failed: ${url}"
  log_success "${label}"
}

dev_start_web() {
  local web_dir
  local pid_file
  local log_file
  local pid
  local listener

  need_cmd pnpm
  need_cmd curl
  ensure_root_files
  dev_ensure_dirs

  web_dir="$(dev_abs_path "${DEV_WEB_DIR}")"
  [[ -d "${web_dir}" ]] || fail "Expected web app directory: ${web_dir}"

  pid_file="$(dev_pid_file web)"
  log_file="$(dev_log_file web)"

  if pid="$(dev_read_pid "${pid_file}" 2>/dev/null)" && dev_pid_running "${pid}"; then
    if dev_wait_for_url "$(dev_web_health_url)" "[dev-web] health"; then
      log_success "[dev-web] already running (pid ${pid})"
      return 0
    fi

    fail "[dev-web] pid ${pid} is running but health is not reachable"
  fi

  rm -f "${pid_file}"

  if dev_port_listening "${DEV_WEB_PORT}"; then
    listener="$(dev_port_listener "${DEV_WEB_PORT}")"
    fail "[dev-web] port ${DEV_WEB_PORT} is already in use (${listener:-unknown}); set DEV_WEB_PORT in ${DEV_CONFIG_FILE}"
  fi

  log_info "[dev-web] host=$(dev_web_url /) dir=${DEV_WEB_DIR} health=${DEV_WEB_HEALTH_PATH}"
  log_step "[dev-web] launching next dev"

  nohup bash -c '
    cd "$1"
    exec pnpm --filter @vicina/webapp exec next dev -H "$2" -p "$3"
  ' bash "${REPO_ROOT}" "${DEV_WEB_HOST}" "${DEV_WEB_PORT}" > "${log_file}" 2>&1 &

  pid="$!"
  disown "${pid}" 2>/dev/null || true
  printf '%s\n' "${pid}" > "${pid_file}"

  if ! dev_wait_for_url "$(dev_web_health_url)" "[dev-web] health"; then
    log_warn "[dev-web] recent log output follows"
    tail -n 80 "${log_file}" >&2 || true
    dev_stop_web
    fail "[dev-web] failed to start"
  fi

  log_success "[dev-web] started (pid ${pid})"
}

dev_stop_web() {
  local pid_file
  local pid
  local elapsed=0
  local listener

  dev_ensure_dirs
  pid_file="$(dev_pid_file web)"

  if pid="$(dev_read_pid "${pid_file}" 2>/dev/null)"; then
    if dev_pid_running "${pid}"; then
      log_step "[dev-web] stopping pid ${pid}"
      kill "${pid}" >/dev/null 2>&1 || true

      while dev_pid_running "${pid}" && [[ "${elapsed}" -lt "${DEV_STOP_TIMEOUT_SECONDS}" ]]; do
        sleep 1
        elapsed=$((elapsed + 1))
      done

      if dev_pid_running "${pid}"; then
        log_warn "[dev-web] pid ${pid} did not stop cleanly; forcing"
        kill -9 "${pid}" >/dev/null 2>&1 || true
      fi

      wait "${pid}" 2>/dev/null || true
      log_success "[dev-web] stopped"
    else
      log_warn "[dev-web] removing stale pid file (${pid})"
    fi

    rm -f "${pid_file}"
  else
    log_info "[dev-web] no managed pid file"
  fi

  if dev_port_listening "${DEV_WEB_PORT}"; then
    listener="$(dev_port_listener "${DEV_WEB_PORT}")"
    log_warn "[dev-web] port ${DEV_WEB_PORT} is still in use (${listener:-unknown})"
  else
    log_success "[dev-web] port ${DEV_WEB_PORT} is free"
  fi
}

dev_print_status() {
  local pid_file
  local pid="none"
  local status="stopped"
  local listener="no"

  dev_ensure_dirs
  pid_file="$(dev_pid_file web)"

  if dev_port_listening "${DEV_WEB_PORT}"; then
    listener="yes"
  fi

  if pid="$(dev_read_pid "${pid_file}" 2>/dev/null)"; then
    if dev_pid_running "${pid}"; then
      status="running"
    else
      status="stale"
    fi
  else
    pid="none"
  fi

  printf '%-10s %-8s %s\n' "SERVICE" "STATUS" "INFO"
  printf '%-10s %-8s listener=%s pid=%s url=%s\n' "web" "${status}" "${listener}" "${pid}" "$(dev_web_url /)"
}
