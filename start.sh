#!/usr/bin/env bash

set -euo pipefail

SERVER_HOST="${__VF_PROJECT_AI_SERVER_HOST__:-localhost}"
SERVER_PORT="${__VF_PROJECT_AI_SERVER_PORT__:-8787}"
CLIENT_HOST="${__VF_PROJECT_AI_CLIENT_HOST__:-}"
CLIENT_PORT="${__VF_PROJECT_AI_CLIENT_PORT__:-5173}"
CLIENT_MODE='dev'
RUN_MODE=''
ACTION='start'

LOG_DIR='.logs'
SERVER_LOG_FILE="${LOG_DIR}/server.log"
CLIENT_LOG_FILE="${LOG_DIR}/client.log"
SERVER_PID_FILE="${LOG_DIR}/vfui-server.pid"
CLIENT_PID_FILE="${LOG_DIR}/vfui-client.pid"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --client-mode=*)
      CLIENT_MODE="${1#*=}"
      ;;
    --client-mode)
      shift
      CLIENT_MODE="${1:-dev}"
      ;;
    --prod-test|--test-prod)
      CLIENT_MODE='prod'
      ;;
    --detached)
      RUN_MODE='detached'
      ;;
    --foreground)
      RUN_MODE='foreground'
      ;;
    --stop)
      ACTION='stop'
      ;;
    --restart)
      ACTION='restart'
      ;;
  esac
  shift || true
done

if [ -z "${RUN_MODE}" ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    RUN_MODE='foreground'
  else
    RUN_MODE='detached'
  fi
fi

export __VF_PROJECT_AI_CLIENT_MODE__="${CLIENT_MODE}"
export __VF_PROJECT_AI_CLIENT_BASE__='/ui'
export __VF_PROJECT_AI_SERVER_HOST__="${SERVER_HOST}"
export __VF_PROJECT_AI_SERVER_PORT__="${SERVER_PORT}"
export __VF_PROJECT_AI_SERVER_ALLOW_CORS__="${__VF_PROJECT_AI_SERVER_ALLOW_CORS__:-true}"
export __VF_PROJECT_AI_CLIENT_PORT__="${CLIENT_PORT}"
if [ -n "${CLIENT_HOST}" ]; then
  export __VF_PROJECT_AI_CLIENT_HOST__="${CLIENT_HOST}"
else
  unset __VF_PROJECT_AI_CLIENT_HOST__ || true
fi

ensure_workspace_install() {
  node ./scripts/check-workspace-install.mjs || exit 1
}

ensure_logs_dir() {
  mkdir -p "${LOG_DIR}"
}

read_pid_file() {
  local pid_file="$1"
  if [ ! -f "${pid_file}" ]; then
    return 0
  fi

  tr -d '[:space:]' < "${pid_file}"
}

process_alive() {
  local pid="$1"
  [ -n "${pid}" ] && kill -0 "${pid}" >/dev/null 2>&1
}

clear_stale_pid_file() {
  local pid_file="$1"
  local pid
  pid="$(read_pid_file "${pid_file}")"
  if [ -n "${pid}" ] && ! process_alive "${pid}"; then
    rm -f "${pid_file}"
  fi
}

is_pid_listening_on_port() {
  local pid="$1"
  local port="$2"
  local port_pids
  port_pids="$({ lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true; } | xargs 2>/dev/null)"
  case " ${port_pids} " in
    *" ${pid} "*) return 0 ;;
    *) return 1 ;;
  esac
}

is_port_in_use() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi

  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

find_next_available_port() {
  local port="$1"
  while is_port_in_use "${port}"; do
    port=$((port + 1))
  done
  echo "${port}"
}

prompt_for_port_switch() {
  local label="$1"
  local current_port="$2"
  local suggested_port="$3"

  if [ ! -t 0 ] || [ ! -t 1 ] || [ ! -e /dev/tty ]; then
    return 1
  fi

  local answer
  printf '[start] %s port %s is in use. Switch to %s? [Y/n] ' "${label}" "${current_port}" "${suggested_port}" > /dev/tty
  read -r answer < /dev/tty
  case "${answer}" in
    ''|y|Y|yes|YES|Yes)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_server_port_available() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  clear_stale_pid_file "${SERVER_PID_FILE}"
  local existing_server_pid
  existing_server_pid="$(read_pid_file "${SERVER_PID_FILE}")"
  if [ -n "${existing_server_pid}" ] &&
    process_alive "${existing_server_pid}" &&
    is_pid_listening_on_port "${existing_server_pid}" "${SERVER_PORT}"; then
    return 0
  fi

  local port_owner
  port_owner="$(lsof -nP -iTCP:${SERVER_PORT} -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)"
  if [ -z "${port_owner}" ]; then
    return 0
  fi

  local next_port
  next_port="$(find_next_available_port "$((SERVER_PORT + 1))")"
  if prompt_for_port_switch 'Server' "${SERVER_PORT}" "${next_port}"; then
    SERVER_PORT="${next_port}"
    export __VF_PROJECT_AI_SERVER_PORT__="${SERVER_PORT}"
    echo "[start] Using server port ${SERVER_PORT} for this worktree."
    return 0
  fi

  echo "[start] Server port ${SERVER_PORT} is already in use. Stop the existing server or rerun with __VF_PROJECT_AI_SERVER_PORT__=${next_port}."
  echo "${port_owner}"
  exit 1
}

ensure_client_port_available() {
  if [ "${CLIENT_MODE}" != 'dev' ] || ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  clear_stale_pid_file "${CLIENT_PID_FILE}"
  local existing_client_pid
  existing_client_pid="$(read_pid_file "${CLIENT_PID_FILE}")"
  if [ -n "${existing_client_pid}" ] &&
    process_alive "${existing_client_pid}" &&
    is_pid_listening_on_port "${existing_client_pid}" "${CLIENT_PORT}"; then
    return 0
  fi

  local port_owner
  port_owner="$(lsof -nP -iTCP:${CLIENT_PORT} -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)"
  if [ -z "${port_owner}" ]; then
    return 0
  fi

  local next_port
  next_port="$(find_next_available_port "$((CLIENT_PORT + 1))")"
  if prompt_for_port_switch 'Client' "${CLIENT_PORT}" "${next_port}"; then
    CLIENT_PORT="${next_port}"
    export __VF_PROJECT_AI_CLIENT_PORT__="${CLIENT_PORT}"
    echo "[start] Using client port ${CLIENT_PORT} for this worktree."
    return 0
  fi

  echo "[start] Client port ${CLIENT_PORT} is already in use. Stop the existing client or rerun with __VF_PROJECT_AI_CLIENT_PORT__=${next_port}."
  echo "${port_owner}"
  exit 1
}

wait_for_server_ready() {
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  local attempt
  for attempt in $(seq 1 50); do
    if curl -fsS "http://localhost:${SERVER_PORT}/api/auth/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "[start] Server failed to become ready on http://localhost:${SERVER_PORT}/api/auth/status."
  echo "[start] See ${SERVER_LOG_FILE} for details."
  exit 1
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"
  local silent="${3:-false}"

  clear_stale_pid_file "${pid_file}"
  local pid
  pid="$(read_pid_file "${pid_file}")"
  if [ -z "${pid}" ]; then
    if [ "${silent}" != 'true' ]; then
      echo "[start] ${label} is not running."
    fi
    return 0
  fi

  if [ "${silent}" != 'true' ]; then
    echo "[start] Stopping ${label} (pid ${pid})."
  fi
  kill -TERM -- "-${pid}" >/dev/null 2>&1 || true
  kill "${pid}" >/dev/null 2>&1 || true

  local attempt
  for attempt in $(seq 1 25); do
    if ! process_alive "${pid}"; then
      rm -f "${pid_file}"
      return 0
    fi
    sleep 0.2
  done

  if process_alive "${pid}"; then
    if [ "${silent}" != 'true' ]; then
      echo "[start] ${label} did not exit after SIGTERM, forcing shutdown."
    fi
    kill -KILL -- "-${pid}" >/dev/null 2>&1 || true
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${pid_file}"
}

start_detached_process() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  clear_stale_pid_file "${pid_file}"
  local existing_pid
  existing_pid="$(read_pid_file "${pid_file}")"
  if [ -n "${existing_pid}" ] && process_alive "${existing_pid}"; then
    echo "[start] ${label} already running (pid ${existing_pid})."
    return 0
  fi

  touch "${log_file}"
  local pid
  pid="$(
    python3 - "${log_file}" "$@" <<'PY'
import subprocess
import sys

log_path = sys.argv[1]
cmd = sys.argv[2:]

with open(log_path, "ab", buffering=0) as log_file, open("/dev/null", "rb", buffering=0) as devnull:
    process = subprocess.Popen(
        cmd,
        stdin=devnull,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

print(process.pid)
PY
  )"
  if [ -z "${pid}" ]; then
    echo "[start] Failed to start ${label}."
    exit 1
  fi
  echo "${pid}" > "${pid_file}"
  echo "[start] Started ${label} (pid ${pid}). Log: ${log_file}"
}

start_foreground_process() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  clear_stale_pid_file "${pid_file}"
  local existing_pid
  existing_pid="$(read_pid_file "${pid_file}")"
  if [ -n "${existing_pid}" ] && process_alive "${existing_pid}"; then
    echo "[start] ${label} already running (pid ${existing_pid})."
    exit 0
  fi

  touch "${log_file}"
  "$@" >> "${log_file}" 2>&1 &
  local pid=$!
  echo "${pid}" > "${pid_file}"
  echo "[start] Started ${label} (pid ${pid}). Log: ${log_file}"
  printf '%s\n' "${pid}"
}

monitor_foreground_processes() {
  local server_pid="$1"
  local client_pid="${2:-}"

  while true; do
    if ! process_alive "${server_pid}"; then
      echo "[start] Server exited. See ${SERVER_LOG_FILE}."
      return 1
    fi

    if [ -n "${client_pid}" ] && ! process_alive "${client_pid}"; then
      echo "[start] Client exited. See ${CLIENT_LOG_FILE}."
      return 1
    fi

    sleep 1
  done
}

cleanup_foreground() {
  stop_pid_file "${CLIENT_PID_FILE}" 'client' true
  stop_pid_file "${SERVER_PID_FILE}" 'server' true
}

ensure_logs_dir

if [ "${ACTION}" = 'stop' ]; then
  stop_pid_file "${CLIENT_PID_FILE}" 'client'
  stop_pid_file "${SERVER_PID_FILE}" 'server'
  exit 0
fi

ensure_workspace_install

if [ "${ACTION}" = 'restart' ]; then
  stop_pid_file "${CLIENT_PID_FILE}" 'client' true
  stop_pid_file "${SERVER_PID_FILE}" 'server' true
fi

ensure_server_port_available
ensure_client_port_available

if [ "${CLIENT_MODE}" != 'dev' ]; then
  (cd apps/client && npx vite build)
fi

if [ "${RUN_MODE}" = 'detached' ]; then
  start_detached_process 'server' "${SERVER_PID_FILE}" "${SERVER_LOG_FILE}" ./node_modules/.bin/vfui-server
  wait_for_server_ready
  if [ "${CLIENT_MODE}" = 'dev' ]; then
    start_detached_process 'client' "${CLIENT_PID_FILE}" "${CLIENT_LOG_FILE}" ./node_modules/.bin/vfui-client
  fi
  echo "[start] UI: http://localhost:${CLIENT_PORT}/ui"
  echo "[start] Server: http://localhost:${SERVER_PORT}"
  echo "[start] Stop with: ./start.sh --stop"
  exit 0
fi

trap cleanup_foreground EXIT INT TERM

SERVER_CHILD_PID="$(start_foreground_process 'server' "${SERVER_PID_FILE}" "${SERVER_LOG_FILE}" ./node_modules/.bin/vfui-server)"
wait_for_server_ready
CLIENT_CHILD_PID=''
if [ "${CLIENT_MODE}" = 'dev' ]; then
  CLIENT_CHILD_PID="$(start_foreground_process 'client' "${CLIENT_PID_FILE}" "${CLIENT_LOG_FILE}" ./node_modules/.bin/vfui-client)"
fi

echo "[start] UI: http://localhost:${CLIENT_PORT}/ui"
echo "[start] Server: http://localhost:${SERVER_PORT}"
echo "[start] Logs: ${SERVER_LOG_FILE} ${CLIENT_LOG_FILE}"

monitor_foreground_processes "${SERVER_CHILD_PID}" "${CLIENT_CHILD_PID}"
