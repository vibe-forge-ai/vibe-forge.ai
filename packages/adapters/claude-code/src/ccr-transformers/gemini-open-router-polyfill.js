const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const writeDebugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  try {
    const logMessage = data
      ? `# [${timestamp}] ${message}:\n` +
        "```json\n" +
        `${JSON.stringify(data, null, 2)}\n` +
        "```\n"
      : `# [${timestamp}] ${message}\n`;

    const logPath = path.join(
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      ".ai",
      "logs",
      process.env.__VF_PROJECT_AI_CTX_ID__,
      process.env.__VF_PROJECT_AI_SESSION_ID__,
      "adapter-claude-code",
      "gemini-open-router-polyfill.js.log.md",
    );
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    fs.appendFileSync(logPath, logMessage);
  } catch (error) {
    fs.appendFileSync(
      path.join(__dirname, "temp.log.md"),
      `# [${timestamp}] ${error}\n`,
    );
    // 静默处理写入错误，避免影响正常流程
  }
};

class GeminiTransformer {
  name = "gemini-schema-cleaner";
  lastSignature = null;

  constructor(options) {
    writeDebugLog("GeminiTransformer constructor", options);
  }

  // Extract signature from response data (works for both JSON and streaming)
  extractSignatureFromResponse(responseData) {
    if (!responseData || !responseData.choices) {
      return;
    }

    for (const choice of responseData.choices) {
      // Check delta.tool_calls for signature
      if (choice.delta?.tool_calls && Array.isArray(choice.delta.tool_calls)) {
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.signature) {
            this.lastSignature = toolCall.signature;
            return;
          }
        }
      }

      // Check message.tool_calls for signature
      if (
        choice.message?.tool_calls &&
        Array.isArray(choice.message.tool_calls)
      ) {
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.signature) {
            this.lastSignature = toolCall.signature;
            return;
          }
        }
      }

      // Check message-level signature
      if (choice.message?.signature) {
        this.lastSignature = choice.message.signature;
        return;
      }

      // Check delta-level signature
      if (choice.delta?.signature) {
        this.lastSignature = choice.delta.signature;
        return;
      }
    }
  }

  cleanupParameters(obj, keyName) {
    if (!obj || typeof obj !== "object") {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => {
        this.cleanupParameters(item);
      });
      return;
    }

    const validFields = new Set([
      "type",
      "format",
      "title",
      "description",
      "nullable",
      "enum",
      "maxItems",
      "minItems",
      "properties",
      "required",
      "minProperties",
      "maxProperties",
      "minLength",
      "maxLength",
      "pattern",
      "example",
      "anyOf",
      "propertyOrdering",
      "default",
      "items",
      "minimum",
      "maximum",
    ]);

    if (keyName !== "properties") {
      Object.keys(obj).forEach((key) => {
        if (!validFields.has(key)) {
          delete obj[key];
        }
      });
    }

    if (Array.isArray(obj.type)) {
      // 莫名奇妙的 jsonschema 序列化问题
      // 序列化 ts lsp mcp 工具的 jsonschema 时，会出现 type 数组
      // 但是 gemini 的 openrouter 平台有毛病，让 claude 一直认不出来他
      // 这里转化为标准 anyOf，我猜可能是版本问题
      obj.anyOf = obj.type.map((type) => ({ type }));
      delete obj.type;
    }

    if (obj.enum && obj.type !== "string") {
      delete obj.enum;
    }

    if (
      obj.type === "string" &&
      obj.format &&
      !["enum", "date-time"].includes(obj.format)
    ) {
      delete obj.format;
    }

    Object.keys(obj).forEach((key) => {
      this.cleanupParameters(obj[key], key);
    });
  }

  async transformRequestIn(request) {
    // Extract signature from previous conversation messages
    if (request.messages && Array.isArray(request.messages)) {
      for (const message of request.messages) {
        if (message.role === "assistant" && message.signature) {
          this.lastSignature = message.signature;
        }
        // Also check tool_calls for signature
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          for (const toolCall of message.tool_calls) {
            if (toolCall.signature) {
              this.lastSignature = toolCall.signature;
            }
          }
        }

        // Fix empty content arrays - Gemini requires at least one parts field
        if (message.content && Array.isArray(message.content)) {
          if (message.content.length === 0) {
            // If content is empty array, add a placeholder text part
            message.content = [{ type: "text", text: "" }];
          } else {
            // Check if all content parts are empty or invalid
            const validParts = message.content.filter((part) => {
              if (
                part.type === "text" &&
                part.text &&
                part.text.trim() !== ""
              ) {
                return true;
              }
              if (part.type === "image_url" || part.type === "image") {
                return true;
              }
              return false;
            });

            if (validParts.length === 0) {
              // If no valid parts, add a placeholder
              message.content = [{ type: "text", text: "" }];
            } else {
              message.content = validParts;
            }
          }
        } else if (
          !message.content ||
          (typeof message.content === "string" && message.content.trim() === "")
        ) {
          // Handle string content or missing content
          message.content = [{ type: "text", text: message.content || "" }];
        }
      }
    }

    // Handle tools compatibility - remove $schema and other incompatible fields
    if (request.tools && Array.isArray(request.tools)) {
      for (const tool of request.tools) {
        if (tool.function && tool.function.parameters) {
          // Clean up parameters by removing $schema and other invalid fields
          this.cleanupParameters(tool.function.parameters);
        }
      }
    }

    // Ensure signature is added to assistant messages with tool_calls
    if (
      request.messages &&
      Array.isArray(request.messages) &&
      this.lastSignature
    ) {
      for (const message of request.messages) {
        if (
          message.role === "assistant" &&
          message.tool_calls &&
          Array.isArray(message.tool_calls)
        ) {
          // If assistant message has tool_calls but no signature, add it
          if (!message.signature) {
            message.signature = this.lastSignature;
          }
          // Also ensure tool_calls have signature if they don't already have it
          for (const toolCall of message.tool_calls) {
            if (!toolCall.signature) {
              toolCall.signature = this.lastSignature;
            }
          }
        }
      }
    }

    // Keep the original OpenAI-like format, just clean up incompatible fields
    return request;
  }

  async transformResponseOut(response) {
    writeDebugLog("Response Out:", response);
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const rawJsonResponse = await response.json();

      // Extract and store signature from response
      this.extractSignatureFromResponse(rawJsonResponse);

      // Return the original response
      return new Response(JSON.stringify(rawJsonResponse), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } else if (response.headers.get("Content-Type")?.includes("stream")) {
      if (!response.body) {
        return response;
      }

      const decoder = new TextDecoder();
      let fullStreamContent = "";
      let streamChunks = [];

      // Read the entire stream to capture final result
      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullStreamContent += chunk;

          // Parse individual chunks for detailed logging
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (
              line.trim() &&
              line.startsWith("data: ") &&
              line.trim() !== "data: [DONE]"
            ) {
              try {
                const data = JSON.parse(line.slice(6));
                streamChunks.push(data);
                // Extract signature from each chunk
                this.extractSignatureFromResponse(data);
              } catch (e) {
                // Ignore parsing errors for non-JSON lines
              }
            }
          }
        }
      } catch (error) {
        // this.writeDebugLog("Error reading stream", { error: error.message });
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {
          // this.writeDebugLog("Error releasing reader lock", { error: e.message });
        }
      }

      // Create a new stream with the same content
      const newStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(fullStreamContent));
          controller.close();
        },
      });

      return new Response(newStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Default case: return original response
    return response;
  }
}

module.exports = GeminiTransformer;
