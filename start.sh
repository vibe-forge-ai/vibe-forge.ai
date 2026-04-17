SERVER_PORT="${__VF_PROJECT_AI_SERVER_PORT__:-8787}"
CLIENT_MODE='dev'

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
  esac
  shift || true
done

export __VF_PROJECT_AI_CLIENT_MODE__="${CLIENT_MODE}"
export __VF_PROJECT_AI_CLIENT_BASE__='/ui'
export __VF_PROJECT_AI_SERVER_PORT__="${SERVER_PORT}"

ensure_workspace_install() {
  node ./scripts/check-workspace-install.mjs || exit 1
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
  local current_port="$1"
  local suggested_port="$2"

  if [ ! -t 0 ] || [ ! -t 1 ] || [ ! -e /dev/tty ]; then
    return 1
  fi

  local answer
  printf '[start] Port %s is in use. Switch server port to %s? [Y/n] ' "${current_port}" "${suggested_port}" > /dev/tty
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

  local port_owner
  port_owner="$(lsof -nP -iTCP:${SERVER_PORT} -sTCP:LISTEN 2>/dev/null | tail -n +2)"
  if [ -z "${port_owner}" ]; then
    return 0
  fi

  local next_port
  next_port="$(find_next_available_port "$((SERVER_PORT + 1))")"
  if prompt_for_port_switch "${SERVER_PORT}" "${next_port}"; then
    SERVER_PORT="${next_port}"
    export __VF_PROJECT_AI_SERVER_PORT__="${SERVER_PORT}"
    echo "[start] Using server port ${SERVER_PORT} for this worktree."
    return 0
  fi

  echo "[start] Port ${SERVER_PORT} is already in use. Stop the existing server or rerun with __VF_PROJECT_AI_SERVER_PORT__=${next_port}."
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
  echo "[start] See .logs/server.log for details."
  exit 1
}

ensure_workspace_install
ensure_server_port_available

mkdir -p .logs

if [ "${CLIENT_MODE}" != 'dev' ]; then
  (cd apps/client && npx vite build)
fi

# 后台运行 server
npx vfui-server | tee .logs/server.log &
wait_for_server_ready
if [ "${CLIENT_MODE}" = 'dev' ]; then
  npx vfui-client | tee .logs/client.log &
fi

# 退出时终止所有后台进程
trap 'kill 0' EXIT
# 等待所有后台进程结束
wait
