import { runHookCli } from '@vibe-forge/core/hooks'

import { isClaudeNativeHookEnv, runClaudeHookBridge } from './claude-runtime'

void (isClaudeNativeHookEnv() ? runClaudeHookBridge() : runHookCli())
