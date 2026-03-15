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

mkdir -p .logs

if [ "${CLIENT_MODE}" != 'dev' ]; then
  (cd apps/client && npx vite build)
fi

# 后台运行 server
npx vfui-server | tee .logs/server.log &
if [ "${CLIENT_MODE}" = 'dev' ]; then
  npx vfui-client | tee .logs/client.log &
fi

# 退出时终止所有后台进程
trap 'kill 0' EXIT
# 等待所有后台进程结束
wait
