// content.js - WebMCP Content Script (runs in MAIN world)

(function () {
  const SCRIPT_ID = "webmcp-inspector-bridge";
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  // Helper to query tools from available WebMCP surfaces
  async function queryTools() {
    try {
      // 1. Try navigator.modelContextTesting (Standard Chrome WebMCP testing flag)
      if (window.navigator?.modelContextTesting?.listTools) {
        const rawTools = await window.navigator.modelContextTesting.listTools();
        if (Array.isArray(rawTools)) {
          return rawTools.map(formatToolDefinition);
        }
      }

      // 2. Try document.modelContext or navigator.modelContext
      const modelContext = document.modelContext || window.navigator?.modelContext;
      if (modelContext?.getTools) {
        const rawTools = await modelContext.getTools();
        if (Array.isArray(rawTools)) {
          return rawTools.map(formatToolDefinition);
        }
      }

      // 3. Check for window.__WEBMCP_TOOLS__ or custom registry
      if (window.__WEBMCP_TOOLS__ && Array.isArray(window.__WEBMCP_TOOLS__)) {
        return window.__WEBMCP_TOOLS__.map(formatToolDefinition);
      }

      return [];
    } catch (err) {
      console.warn("[WebMCP Inspector] Error listing tools:", err);
      return [];
    }
  }

  function formatToolDefinition(t) {
    if (!t) return null;
    return {
      name: t.name || "unnamed_tool",
      description: t.description || "",
      inputSchema: t.inputSchema || t.parameters || { type: "object", properties: {} },
      annotations: t.annotations || null
    };
  }

  // Execute a tool by name with arguments
  async function executeTool(name, args) {
    try {
      const argsJson = typeof args === "string" ? args : JSON.stringify(args || {});
      const argsObj = typeof args === "string" ? JSON.parse(args || "{}") : (args || {});

      // Method 1: document.modelContext.executeTool(RegisteredTool, JSONString)
      // Per W3C WebMCP spec: executeTool expects the RegisteredTool object from getTools(), not a string!
      const docContext = document.modelContext || window.navigator?.modelContext;
      if (docContext && typeof docContext.getTools === "function" && typeof docContext.executeTool === "function") {
        try {
          const registeredTools = await docContext.getTools();
          const targetTool = (registeredTools || []).find((t) => t.name === name);
          if (targetTool) {
            const rawResult = await docContext.executeTool(targetTool, argsJson);
            let parsed = rawResult;
            if (typeof rawResult === "string") {
              try { parsed = JSON.parse(rawResult); } catch (e) { parsed = rawResult; }
            }
            return { success: true, result: parsed !== undefined ? parsed : "Tool executed successfully." };
          }
        } catch (e1) {
          console.warn("[WebMCP] document.modelContext.executeTool(RegisteredTool) failed:", e1);
        }
      }

      // Method 2: navigator.modelContextTesting.executeTool(toolNameString, JSONString) - Chromium Testing Interface
      const testingContext = window.navigator?.modelContextTesting;
      if (testingContext && typeof testingContext.executeTool === "function") {
        try {
          const rawResult = await testingContext.executeTool(name, argsJson);
          let parsed = rawResult;
          if (typeof rawResult === "string") {
            try { parsed = JSON.parse(rawResult); } catch (e) { parsed = rawResult; }
          }
          return { success: true, result: parsed !== undefined ? parsed : "Tool executed successfully." };
        } catch (e2) {
          try {
            const rawResult = await testingContext.executeTool(name, argsObj);
            return { success: true, result: rawResult !== undefined ? rawResult : "Tool executed successfully." };
          } catch (e2b) {
            console.warn("[WebMCP] modelContextTesting.executeTool failed:", e2b);
          }
        }
      }

      // Method 3: In-object tool.execute(argsObj) callback
      if (docContext && typeof docContext.getTools === "function") {
        try {
          const registeredTools = await docContext.getTools();
          const targetTool = (registeredTools || []).find((t) => t.name === name);
          if (targetTool && typeof targetTool.execute === "function") {
            const res = await targetTool.execute(argsObj);
            return { success: true, result: res !== undefined ? res : "Tool executed successfully." };
          }
        } catch (e3) {
          console.warn("[WebMCP] tool.execute callback failed:", e3);
        }
      }

      // Method 4: window.__WEBMCP_EXECUTE_TOOL__
      if (typeof window.__WEBMCP_EXECUTE_TOOL__ === "function") {
        try {
          const r = await window.__WEBMCP_EXECUTE_TOOL__(name, argsObj);
          return { success: true, result: r };
        } catch (e4) {
          return { success: false, error: e4.message || String(e4) };
        }
      }

      return {
        success: false,
        error: `Tool "${name}" could not be executed on this page.`
      };
    } catch (err) {
      console.error(`[WebMCP Inspector] Error executing tool "${name}":`, err);
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }

  // Listen for tool changes if supported by browser
  if (window.navigator?.modelContextTesting?.registerToolsChangedCallback) {
    try {
      window.navigator.modelContextTesting.registerToolsChangedCallback(async () => {
        const tools = await queryTools();
        window.postMessage({ type: "WEBMCP_TOOLS_UPDATED", tools }, "*");
      });
    } catch (e) {
      // Ignore
    }
  }

  // Handle messages from Extension Sidepanel
  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data || !event.data.type) return;

    if (event.data.type === "WEBMCP_INSPECTOR_QUERY_TOOLS") {
      const tools = await queryTools();
      window.postMessage({
        type: "WEBMCP_INSPECTOR_QUERY_TOOLS_RESPONSE",
        requestId: event.data.requestId,
        tools: tools.filter(Boolean)
      }, "*");
    } else if (event.data.type === "WEBMCP_INSPECTOR_EXECUTE_TOOL") {
      const response = await executeTool(event.data.name, event.data.args);
      window.postMessage({
        type: "WEBMCP_INSPECTOR_EXECUTE_TOOL_RESPONSE",
        requestId: event.data.requestId,
        response
      }, "*");
    }
  });

  // Also support chrome.runtime if available in this context
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "GET_TOOLS") {
        queryTools().then((tools) => sendResponse({ tools: tools.filter(Boolean) }));
        return true;
      }
      if (msg.type === "EXECUTE_TOOL") {
        executeTool(msg.name, msg.args).then((result) => sendResponse(result));
        return true;
      }
    });
  }
})();
