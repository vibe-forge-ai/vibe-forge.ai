export WORKSPACE_FOLDER=`realpath .`
export HOME=`realpath ./.ai/.mock`
export CLAUDE_CODE_CLI_PATH=`realpath ./apps/server/node_modules/.bin/ccr`
export CLAUDE_CODE_CLI_ARGS="code"
export FORCE_COLOR=1

# 后台运行 server
node -C __vibe-forge__ -r esbuild-register ./apps/server/src/index.ts | tee .logs/server.log &
echo $PWD
# 后台运行 client
cd ./apps/web && npm run dev | tee .logs/client.log &

# 退出时终止所有后台进程
trap "kill 0" EXIT
# 等待所有后台进程结束
wait
