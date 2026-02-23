export HOME=`realpath ./.ai/.mock`

export __VF_PROJECT_WORKSPACE_FOLDER__=`realpath .`
export __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__='./packages/adapters/claude-code/node_modules/.bin/ccr'
export __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_ARGS__="code"

# 后台运行 server
npx vfui-server | tee .logs/server.log &
# 后台运行 client
npx vfui-client | tee .logs/client.log &

# 退出时终止所有后台进程
trap "kill 0" EXIT
# 等待所有后台进程结束
wait
