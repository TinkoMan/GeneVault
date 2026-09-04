
function extractResponsesApiText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
  if (typeof data.content === "string" && data.content.trim()) return data.content.trim();
  if (typeof data.response === "string" && data.response.trim()) return data.response.trim();

  let collected = [];
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item) continue;
      if (item.type === "function_call" || item.type === "tool_call") continue;
      if (typeof item === "string" && item.trim()) collected.push(item.trim());
      else if (typeof item.text === "string" && item.text.trim()) collected.push(item.text.trim());
      else if (typeof item.output_text === "string" && item.output_text.trim()) collected.push(item.output_text.trim());
      else if (item.content) {
        if (typeof item.content === "string" && item.content.trim()) collected.push(item.content.trim());
        else if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c === "string" && c.trim()) collected.push(c.trim());
            else if (c && typeof c.text === "string" && c.text.trim()) collected.push(c.text.trim());
            else if (c && typeof c.value === "string" && c.value.trim()) collected.push(c.value.trim());
          }
        } else if (typeof item.content === "object" && typeof item.content.text === "string") {
          collected.push(item.content.text.trim());
        }
      } else if (typeof item.reasoning === "string" && item.reasoning.trim()) {
        collected.push(item.reasoning.trim());
      } else if (typeof item.summary === "string" && item.summary.trim()) {
        collected.push(item.summary.trim());
      }
    }
  }

  if (collected.length > 0) return collected.join("\n\n");

  if (Array.isArray(data.choices) && data.choices[0]) {
    const choice = data.choices[0];
    const msg = choice.message;
    if (msg) {
      if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
      if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim()) return msg.reasoning_content.trim();
    }
    if (typeof choice.text === "string" && choice.text.trim()) return choice.text.trim();
  }

  return "";
}

// ai_agent.js - Multi-Provider Agent with Tool Calling & Custom API Gateway Support (Chat Completions & Responses API)

const OPENCODE_RESPONSES_MODELS = [
  "muse-spark-1.3-contributor-free",
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.3",
  "muse-spark-1.2",
  "gpt-5.6-sol",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "grok-4.6",
  "grok-4.5"
];

function buildSystemPromptWithTools(basePrompt, tools) {
  let p = basePrompt || "You are an AI assistant acting on the current web page. You have access to WebMCP tools provided by this page.";
  if (Array.isArray(tools) && tools.length > 0) {
    const list = tools
      .map((t) => `- ${t.name}: ${t.description || "No description"} (Schema: ${JSON.stringify(t.inputSchema || {})})`)
      .join("\n");
    p += `\n\n[Active WebMCP Page Tools]\nThis web page currently exposes the following WebMCP tools to you:\n${list}\n\nCRITICAL INSTRUCTIONS FOR TOOL USE:\n1. If the user asks general questions like "What tools are available on this page?", "What can you do?", or "List the tools", DO NOT execute the tools. Simply answer directly in Markdown with a clear summary of the tools listed above and what each does.\n2. Only call a tool when the user asks you to perform a specific action, check data, or execute a task on the page.\n3. When calling a tool, ALWAYS provide valid, required arguments matching the tool's input schema (never call a tool with empty arguments {} if it requires parameters).\n4. When a tool finishes, synthesize the return value into a clear, formatted doctor-ready/user-ready response.`;
  }
  return p;
}

export class AIAgent {
  constructor(config = {}) {
    this.config = {
      provider: "opencode",
      model: "big-pickle",
      apiKey: "",
      baseUrl: "https://opencode.ai/zen/v1",
      apiProtocol: "auto",
      customHeaders: {},
      systemPrompt: "You are an AI assistant acting on the current web page. You have access to WebMCP tools provided by this page. Use them when helpful to accomplish the user's request, and format your responses clearly using Markdown.",
      temperature: 0.7,
      maxSteps: 8,
      timeoutMs: 60000,
      ...config
    };
    this.currentAbortController = null;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  abort() {
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch (e) {
        // Ignore
      }
      this.currentAbortController = null;
    }
  }

  /**
   * Run agent conversation turn with tool calling loop
   */
  async runTurn(conversationHistory, webMcpTools = [], executeToolFn, onEvent = () => {}) {
    const { provider, model, baseUrl, apiProtocol } = this.config;

    let targetModel = model || "big-pickle";
    if (targetModel.startsWith("opencode/")) targetModel = targetModel.replace("opencode/", "");
    if (targetModel.startsWith("opencode-go/")) targetModel = targetModel.replace("opencode-go/", "");

    // Smart protocol detection:
    // If provider is OpenCode:
    // Models in OPENCODE_RESPONSES_MODELS -> use Responses API (/responses)
    // All other OpenCode models (mimo-v2.5-free, nemotron-3-ultra-free, big-pickle, etc.) -> use Chat Completions (/chat/completions)!
    let isResponsesProtocol = false;
    if (provider === "opencode") {
      if (apiProtocol === "responses") {
        isResponsesProtocol = true;
      } else if (apiProtocol === "chat_completions") {
        isResponsesProtocol = false;
      } else {
        // Auto-detect
        isResponsesProtocol = OPENCODE_RESPONSES_MODELS.includes(targetModel) || targetModel.includes("muse-spark");
      }
    } else {
      isResponsesProtocol =
        apiProtocol === "responses" ||
        (apiProtocol === "auto" && (
          (baseUrl && baseUrl.includes("/responses")) ||
          targetModel.includes("muse-spark")
        ));
    }

    const safeExecuteTool = async (name, args) => {
      if (name === "discoverTools" || name === "listTools" || name === "getTools" || name === "inspectTools") {
        return {
          success: true,
          tools: webMcpTools.map((t) => ({
            name: t.name,
            description: t.description || "",
            inputSchema: t.inputSchema
          }))
        };
      }
      return await executeToolFn(name, args);
    };

    this.currentAbortController = new AbortController();

    try {
      if (provider === "gemini") {
        return await this.runGeminiLoop(conversationHistory, webMcpTools, safeExecuteTool, onEvent);
      } else if (provider === "claude") {
        return await this.runClaudeLoop(conversationHistory, webMcpTools, safeExecuteTool, onEvent);
      } else if (isResponsesProtocol) {
        return await this.runResponsesLoop(conversationHistory, webMcpTools, safeExecuteTool, onEvent);
      } else {
        return await this.runOpenAILoop(conversationHistory, webMcpTools, safeExecuteTool, onEvent);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        const abortMsg = "Request was cancelled or timed out after 60 seconds. The provider may be experiencing high load or rate limits.";
        onEvent({ type: "error", error: abortMsg });
        throw new Error(abortMsg);
      }
      console.error("[AIAgent] Error during runTurn:", err);
      onEvent({ type: "error", error: err.message || String(err) });
      throw err;
    } finally {
      this.currentAbortController = null;
    }
  }

  // ==========================================
  // RESPONSES API (/responses - Muse Spark, GPT-5.6)
  // ==========================================
  async runResponsesLoop(conversationHistory, webMcpTools, executeToolFn, onEvent) {
    const { model, apiKey, temperature, maxSteps, systemPrompt, timeoutMs } = this.config;
    let endpoint = (this.config.baseUrl || "https://opencode.ai/zen/v1").replace(/\/+$/, "");
    if (!endpoint.endsWith("/responses")) {
      endpoint = endpoint.replace(/\/chat\/completions$/, "") + "/responses";
    }

    let defaultHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };

    if (this.config.customHeaders && typeof this.config.customHeaders === "object") {
      defaultHeaders = { ...defaultHeaders, ...this.config.customHeaders };
    }

    let targetModel = model || "muse-spark-1.3-contributor-free";
    if (targetModel.startsWith("opencode/")) targetModel = targetModel.replace("opencode/", "");
    if (targetModel.startsWith("opencode-go/")) targetModel = targetModel.replace("opencode-go/", "");

    const validTools = (webMcpTools || []).filter((t) => t && t.name && typeof t.name === "string");
    const formattedTools = validTools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description || "",
      parameters: cleanJsonSchema(t.inputSchema)
    }));

    const effectiveSystemPrompt = buildSystemPromptWithTools(systemPrompt, validTools);
    const inputItems = [];

    // Responses API expects string content inside message objects
    for (const msg of conversationHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        inputItems.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : String(msg.content || "")
        });
      }
    }

    let currentStep = 0;
    let finalAssistantText = "";

    while (currentStep < maxSteps) {
      currentStep++;

      const payload = {
        model: targetModel,
        instructions: effectiveSystemPrompt,
        input: inputItems,
        temperature: parseFloat(temperature) || 0.7
      };

      if (formattedTools.length > 0) {
        payload.tools = formattedTools;
      }

      onEvent({ type: "status", status: `Contacting Responses API (${targetModel})...` });

      const fetchTimeout = setTimeout(() => {
        if (this.currentAbortController) this.currentAbortController.abort();
      }, timeoutMs || 60000);

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify(payload),
          signal: this.currentAbortController?.signal
        });
      } finally {
        clearTimeout(fetchTimeout);
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Responses API error (${res.status}): ${errBody}`);
      }

      const data = await res.json();
      let toolCalls = [];
      const rawOutputItems = Array.isArray(data.output) ? data.output : [];

      // Discover any tool calls in the output
      if (rawOutputItems.length > 0) {
        for (const item of rawOutputItems) {
          if (item && (item.type === "function_call" || item.type === "tool_call")) {
            const callId = item.call_id || item.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const fnName = item.name || item.function?.name;
            const fnArgs = item.arguments || item.function?.arguments || "{}";

            toolCalls.push({
              call_id: callId,
              name: fnName,
              arguments: typeof fnArgs === "string" ? fnArgs : JSON.stringify(fnArgs)
            });
          }
        }
      } else if (data.choices && data.choices[0]?.message?.tool_calls) {
        for (const tc of data.choices[0].message.tool_calls) {
          toolCalls.push({
            call_id: tc.id,
            name: tc.function?.name,
            arguments: tc.function?.arguments || "{}"
          });
        }
      }

      // If tool calls were returned, execute each tool
      if (toolCalls.length > 0) {
        if (rawOutputItems.length > 0) {
          for (const item of rawOutputItems) {
            inputItems.push(item);
          }
        } else {
          for (const tc of toolCalls) {
            inputItems.push({
              type: "function_call",
              call_id: tc.call_id,
              name: tc.name,
              arguments: tc.arguments
            });
          }
        }

        for (const toolCall of toolCalls) {
          const fnName = toolCall.name;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(toolCall.arguments || "{}");
          } catch (e) {
            parsedArgs = {};
          }

          onEvent({
            type: "tool_start",
            toolName: fnName,
            args: parsedArgs,
            toolCallId: toolCall.call_id
          });

          let toolOutput;
          try {
            const rawResult = await executeToolFn(fnName, parsedArgs);
            toolOutput = rawResult?.result !== undefined ? rawResult.result : rawResult;
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: parsedArgs,
              result: toolOutput,
              toolCallId: toolCall.call_id
            });
          } catch (err) {
            toolOutput = { error: err.message || String(err) };
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: parsedArgs,
              error: toolOutput.error,
              toolCallId: toolCall.call_id
            });
          }

          const serializedOutput = typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput);

          inputItems.push({
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: serializedOutput
          });
        }
        continue;
      }

      // No tool calls: extract text using comprehensive multi-format extractor
      finalAssistantText = extractResponsesApiText(data);
      if (!finalAssistantText.trim()) {
        // As a safe fallback, serialize any text or data payload
        finalAssistantText = typeof data.output === "string" ? data.output : JSON.stringify(data, null, 2);
      }
      break;
    }

    onEvent({ type: "done", text: finalAssistantText });
    return finalAssistantText;
  }

  // ==========================================
  // OPENAI / CHAT COMPLETIONS STANDARD
  // ==========================================
  async runOpenAILoop(conversationHistory, webMcpTools, executeToolFn, onEvent) {
    const { provider, model, apiKey, temperature, maxSteps, systemPrompt, timeoutMs } = this.config;
    let endpoint = "";
    let defaultHeaders = { "Content-Type": "application/json" };

    if (provider === "opencode") {
      endpoint = (this.config.baseUrl || "https://opencode.ai/zen/v1").replace(/\/+$/, "");
      if (!endpoint.endsWith("/chat/completions")) {
        endpoint = endpoint.replace(/\/responses$/, "") + "/chat/completions";
      }
      defaultHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "openai") {
      endpoint = (this.config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions";
      defaultHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "openrouter") {
      endpoint = (this.config.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "") + "/chat/completions";
      defaultHeaders["Authorization"] = `Bearer ${apiKey}`;
      defaultHeaders["HTTP-Referer"] = "https://github.com/webmcp-ai-agent";
      defaultHeaders["X-Title"] = "WebMCP AI Chat Agent";
    } else if (provider === "ollama") {
      endpoint = (this.config.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "") + "/chat/completions";
      if (apiKey) defaultHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "custom") {
      endpoint = (this.config.baseUrl || "").replace(/\/+$/, "");
      if (!endpoint.endsWith("/chat/completions") && !endpoint.endsWith("/responses")) {
        endpoint += "/chat/completions";
      }
      if (apiKey) defaultHeaders["Authorization"] = `Bearer ${apiKey}`;
    }

    if (this.config.customHeaders && typeof this.config.customHeaders === "object") {
      defaultHeaders = { ...defaultHeaders, ...this.config.customHeaders };
    }

    let targetModel = model || "big-pickle";
    if (provider === "custom" || provider === "openai" || provider === "opencode") {
      if (targetModel.startsWith("opencode/")) {
        targetModel = targetModel.replace("opencode/", "");
      } else if (targetModel.startsWith("opencode-go/")) {
        targetModel = targetModel.replace("opencode-go/", "");
      }
    }

    const validTools = (webMcpTools || []).filter((t) => t && t.name && typeof t.name === "string");
    const formattedTools = validTools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: cleanJsonSchema(t.inputSchema)
      }
    }));

    const effectiveSystemPrompt = buildSystemPromptWithTools(systemPrompt, validTools);
    const messages = [];
    messages.push({ role: "system", content: effectiveSystemPrompt });

    for (const msg of conversationHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : String(msg.content || "")
        });
      }
    }

    let currentStep = 0;
    let finalAssistantText = "";

    while (currentStep < maxSteps) {
      currentStep++;

      const payload = {
        model: targetModel,
        messages,
        temperature: parseFloat(temperature) || 0.7
      };

      if (formattedTools.length > 0) {
        payload.tools = formattedTools;
        payload.tool_choice = "auto";
      }

      onEvent({ type: "status", status: `Contacting ${provider} (${targetModel})...` });

      const fetchTimeout = setTimeout(() => {
        if (this.currentAbortController) this.currentAbortController.abort();
      }, timeoutMs || 60000);

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: defaultHeaders,
          body: JSON.stringify(payload),
          signal: this.currentAbortController?.signal
        });
      } finally {
        clearTimeout(fetchTimeout);
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API error (${res.status} ${res.statusText}): ${errBody}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error("No response returned from model.");
      }

      const responseMessage = choice.message || {};
      messages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const fnName = toolCall.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
          } catch (e) {
            fnArgs = toolCall.function?.arguments || {};
          }

          onEvent({
            type: "tool_start",
            toolName: fnName,
            args: fnArgs,
            toolCallId: toolCall.id
          });

          let toolOutput;
          try {
            const rawResult = await executeToolFn(fnName, fnArgs);
            toolOutput = rawResult?.result !== undefined ? rawResult.result : rawResult;
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: fnArgs,
              result: toolOutput,
              toolCallId: toolCall.id
            });
          } catch (err) {
            toolOutput = { error: err.message || String(err) };
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: fnArgs,
              error: toolOutput.error,
              toolCallId: toolCall.id
            });
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput)
          });
        }
        continue;
      }

      finalAssistantText =
        responseMessage.content ||
        responseMessage.reasoning_content ||
        responseMessage.reasoning ||
        choice.text ||
        "";
      break;
    }

    if (!finalAssistantText.trim()) {
      finalAssistantText = "*(The model completed execution but returned no textual response)*";
    }

    onEvent({ type: "done", text: finalAssistantText });
    return finalAssistantText;
  }

  // ==========================================
  // GOOGLE GEMINI REST API
  // ==========================================
  async runGeminiLoop(conversationHistory, webMcpTools, executeToolFn, onEvent) {
    const { model, apiKey, temperature, maxSteps, systemPrompt, timeoutMs } = this.config;
    if (!apiKey) {
      throw new Error("Gemini API Key is required. Please set it in Settings.");
    }

    const geminiModel = model || "gemini-2.0-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const validTools = (webMcpTools || []).filter((t) => t && t.name && typeof t.name === "string");
    const functionDeclarations = validTools.map((t) => ({
      name: t.name,
      description: t.description || "",
      parameters: cleanGeminiSchema(t.inputSchema)
    }));

    const effectiveSystemPrompt = buildSystemPromptWithTools(systemPrompt, validTools);
    const contents = [];
    for (const msg of conversationHistory) {
      if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant") {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
    }

    let currentStep = 0;
    let finalAssistantText = "";

    while (currentStep < maxSteps) {
      currentStep++;

      const payload = {
        contents,
        generationConfig: {
          temperature: parseFloat(temperature) || 0.7
        },
        systemInstruction: {
          parts: [{ text: effectiveSystemPrompt }]
        }
      };

      if (functionDeclarations.length > 0) {
        payload.tools = [{ functionDeclarations }];
      }

      onEvent({ type: "status", status: `Contacting Gemini (${geminiModel})...` });

      const fetchTimeout = setTimeout(() => {
        if (this.currentAbortController) this.currentAbortController.abort();
      }, timeoutMs || 60000);

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: this.currentAbortController?.signal
        });
      } finally {
        clearTimeout(fetchTimeout);
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errBody}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content) {
        throw new Error("No response returned from Gemini.");
      }

      const parts = candidate.content.parts || [];
      contents.push({ role: "model", parts });

      const functionCallPart = parts.find((p) => p.functionCall);
      if (functionCallPart) {
        const fnCall = functionCallPart.functionCall;
        const fnName = fnCall.name;
        const fnArgs = fnCall.args || {};

        onEvent({
          type: "tool_start",
          toolName: fnName,
          args: fnArgs
        });

        let toolOutput;
        try {
          const rawResult = await executeToolFn(fnName, fnArgs);
          toolOutput = rawResult?.result !== undefined ? rawResult.result : rawResult;
          onEvent({
            type: "tool_end",
            toolName: fnName,
            args: fnArgs,
            result: toolOutput
          });
        } catch (err) {
          toolOutput = { error: err.message || String(err) };
          onEvent({
            type: "tool_end",
            toolName: fnName,
            args: fnArgs,
            error: toolOutput.error
          });
        }

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: fnName,
                response: typeof toolOutput === "object" && toolOutput !== null ? toolOutput : { result: toolOutput }
              }
            }
          ]
        });

        continue;
      }

      finalAssistantText = parts
        .map((p) => p.text || "")
        .filter(Boolean)
        .join("\n");
      break;
    }

    if (!finalAssistantText.trim()) {
      finalAssistantText = "*(The model returned no text)*";
    }

    onEvent({ type: "done", text: finalAssistantText });
    return finalAssistantText;
  }

  // ==========================================
  // ANTHROPIC CLAUDE API
  // ==========================================
  async runClaudeLoop(conversationHistory, webMcpTools, executeToolFn, onEvent) {
    const { model, apiKey, temperature, maxSteps, systemPrompt, timeoutMs } = this.config;
    if (!apiKey) {
      throw new Error("Anthropic API Key is required. Please set it in Settings.");
    }

    const claudeModel = model || "claude-3-5-sonnet-latest";
    const endpoint = (this.config.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "") + "/messages";

    const validTools = (webMcpTools || []).filter((t) => t && t.name && typeof t.name === "string");
    const claudeTools = validTools.map((t) => ({
      name: t.name,
      description: t.description || "",
      input_schema: cleanJsonSchema(t.inputSchema)
    }));

    const effectiveSystemPrompt = buildSystemPromptWithTools(systemPrompt, validTools);
    const messages = [];
    for (const msg of conversationHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : String(msg.content || "")
        });
      }
    }

    let currentStep = 0;
    let finalAssistantText = "";

    while (currentStep < maxSteps) {
      currentStep++;

      const payload = {
        model: claudeModel,
        max_tokens: 4096,
        messages,
        system: effectiveSystemPrompt,
        temperature: parseFloat(temperature) || 0.7
      };

      if (claudeTools.length > 0) {
        payload.tools = claudeTools;
      }

      onEvent({ type: "status", status: `Contacting Claude (${claudeModel})...` });

      const fetchTimeout = setTimeout(() => {
        if (this.currentAbortController) this.currentAbortController.abort();
      }, timeoutMs || 60000);

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            ...(this.config.customHeaders || {})
          },
          body: JSON.stringify(payload),
          signal: this.currentAbortController?.signal
        });
      } finally {
        clearTimeout(fetchTimeout);
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Claude API error (${res.status}): ${errBody}`);
      }

      const data = await res.json();
      const content = data.content || [];
      messages.push({ role: "assistant", content });

      const toolUseBlocks = content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length > 0) {
        const toolResultContent = [];

        for (const block of toolUseBlocks) {
          const fnName = block.name;
          const fnArgs = block.input || {};

          onEvent({
            type: "tool_start",
            toolName: fnName,
            args: fnArgs,
            toolCallId: block.id
          });

          let toolOutput;
          try {
            const rawResult = await executeToolFn(fnName, fnArgs);
            toolOutput = rawResult?.result !== undefined ? rawResult.result : rawResult;
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: fnArgs,
              result: toolOutput,
              toolCallId: block.id
            });
          } catch (err) {
            toolOutput = { error: err.message || String(err) };
            onEvent({
              type: "tool_end",
              toolName: fnName,
              args: fnArgs,
              error: toolOutput.error,
              toolCallId: block.id
            });
          }

          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput)
          });
        }

        messages.push({
          role: "user",
          content: toolResultContent
        });

        continue;
      }

      finalAssistantText = content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      break;
    }

    if (!finalAssistantText.trim()) {
      finalAssistantText = "*(The model returned no text)*";
    }

    onEvent({ type: "done", text: finalAssistantText });
    return finalAssistantText;
  }
}

function cleanJsonSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }
  return schema;
}

function cleanGeminiSchema(schema) {
  const clean = cleanJsonSchema(schema);
  return JSON.parse(JSON.stringify(clean));
}
