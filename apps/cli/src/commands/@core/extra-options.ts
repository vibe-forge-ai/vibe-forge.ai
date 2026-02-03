import process from 'node:process'

// 获取通过 -- 参数传递的额外选项
const extraOptionsStartIndex = process.argv.indexOf('--')
export const extraOptions = extraOptionsStartIndex !== -1
  ? process.argv.slice(extraOptionsStartIndex + 1)
  : []

if (extraOptions.length > 0) {
  // 删除 process.argv 中的额外选项
  process.argv.splice(extraOptionsStartIndex, extraOptions.length + 1)
}
