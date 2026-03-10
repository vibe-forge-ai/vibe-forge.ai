const fs = require('node:fs');
const path = require('node:path');

const writeDebugLog = (message, data = null) => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = data
      ? `# [${timestamp}] ${message}:\n` +
        '```json\n' +
        `${JSON.stringify(data, null, 2)}\n` +
        '```\n'
      : `# [${timestamp}] ${message}\n`;

    const logPath = path.join(__dirname, 'logger.js.log.md');
    fs.appendFileSync(logPath, logMessage);
  } catch (error) {
    // 静默处理写入错误，避免影响正常流程
  }
};

writeDebugLog('load logger');

class LoggerTransformer {
  name = 'logger';

  transformRequestIn(request) {
    writeDebugLog('request', request);
    return request;
  }

  transformResponseOut(response) {
    writeDebugLog('response', response);
    return response;
  }
}

module.exports = LoggerTransformer;
