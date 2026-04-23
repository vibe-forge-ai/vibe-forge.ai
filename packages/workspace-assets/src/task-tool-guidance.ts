export const buildManagedTaskToolGuidance = (serverName: string) => {
  return [
    'Task tool guide:',
    `- Use \`${serverName}.StartTasks\` to start a new child task when the work should run in a separate entity or workspace, or when it needs to continue independently from the current turn.`,
    `- After starting a task, use \`${serverName}.GetTaskInfo\` with \`{ taskId }\` to inspect one task. It is also the right tool when a task seems stalled, failed, or might be waiting for input.`,
    '- By default, `GetTaskInfo` returns the 10 most recent log entries in descending order, so newer entries appear earlier in the `logs` array. Pass `logLimit` to inspect a different number of recent logs, and set `logOrder` to `"asc"` when you want the selected log window in oldest-to-newest order.',
    `- Use \`${serverName}.ListTasks\` with the same \`logLimit\` and \`logOrder\` fields when you need to find a taskId or inspect multiple tasks at once.`,
    `- Use \`${serverName}.SendTaskMessage\` with \`{ taskId, message }\` only when a task status is \`running\` and you need to give it another instruction without starting a replacement task.`,
    `- Use \`${serverName}.SubmitTaskInput\` only when \`${serverName}.GetTaskInfo\` or \`${serverName}.ListTasks\` shows \`pendingInput\` or \`pendingInteraction\`, or the task status is \`waiting_input\`. Do not use it for ordinary follow-up instructions.`,
    '- If a task is `completed` or `failed`, start a new task instead of trying to continue the old one.',
    '- When a task is still making progress, use `wait` between checks instead of repeatedly restarting it.'
  ].join('\n')
}
