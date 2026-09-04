// sidebar.js - WebMCP AI Chat Agent Controller with OpenCode Preconfiguration & Live Model Fetch

import { renderMarkdown } from "./markdown.js";
import { AIAgent } from "./ai_agent.js";

// ==========================================
// STATE & CONFIG DEFAULTS
// ==========================================
const DEFAULT_SETTINGS = {
  provider: "opencode",
  apiProtocol: "auto",
  baseUrl: "https://opencode.ai/zen/v1",
  model: "big-pickle",
  apiKey: "",
  customHeaders: {},
  systemPrompt: "You are an AI assistant acting on the current web page. You have access to WebMCP tools provided by this page. Use them when helpful to accomplish the user's request, and format your responses clearly using Markdown.",
  temperature: 0.7,
  maxSteps: 8
};

const PROVIDER_PRESETS = {
  opencode: {
    defaultBaseUrl: "https://opencode.ai/zen/v1",
    models: [
      { id: "big-pickle", label: "🌟 Big Pickle (Free - Chat Completions)", protocol: "chat_completions" },
      { id: "mimo-v2.5-free", label: "🌟 MiMo-V2.5 Free (Free - Chat Completions)", protocol: "chat_completions" },
      { id: "nemotron-3.5-lightning-free", label: "🌟 Nemotron 3.5 Lightning (Free - Chat Completions)", protocol: "chat_completions" },
      { id: "ling-3.0-flash-fin-free", label: "🌟 Ling 3.0 Flash Fin (Free - Chat Completions)", protocol: "chat_completions" },
      { id: "nemotron-3-ultra-free", label: "🌟 Nemotron 3 Ultra (Free - Chat Completions)", protocol: "chat_completions" },
      { id: "muse-spark-1.3-contributor-free", label: "🌟 Muse Spark 1.3 Contributor (Free - Responses API)", protocol: "responses" },
      { id: "muse-spark-1.2-contributor-free", label: "🌟 Muse Spark 1.2 Contributor (Free - Responses API)", protocol: "responses" },
      { id: "deepseek-v4-flash", label: "⚡ DeepSeek V4 Flash", protocol: "chat_completions" },
      { id: "deepseek-v4-pro", label: "⚡ DeepSeek V4 Pro", protocol: "chat_completions" },
      { id: "qwen3.7-max", label: "⚡ Qwen3.7 Max", protocol: "chat_completions" },
      { id: "qwen3.7-plus", label: "⚡ Qwen3.7 Plus", protocol: "chat_completions" },
      { id: "qwen3.6-plus", label: "⚡ Qwen3.6 Plus", protocol: "chat_completions" },
      { id: "glm-5.2", label: "⚡ GLM-5.2", protocol: "chat_completions" },
      { id: "kimi-k3", label: "⚡ Kimi K3", protocol: "chat_completions" },
      { id: "kimi-k2.7-code", label: "⚡ Kimi K2.7 Code", protocol: "chat_completions" },
      { id: "minimax-m3", label: "⚡ MiniMax M3", protocol: "chat_completions" },
      { id: "gpt-5.6-sol", label: "⚡ GPT 5.6 Sol (Responses API)", protocol: "responses" },
      { id: "gpt-5.6-luna", label: "⚡ GPT 5.6 Luna (Responses API)", protocol: "responses" },
      { id: "claude-sonnet-4.6", label: "⚡ Claude Sonnet 4.6", protocol: "chat_completions" },
      { id: "claude-opus-5", label: "⚡ Claude Opus 5", protocol: "chat_completions" }
    ]
  },
  openai: {
    defaultBaseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", label: "GPT-4o (Omni)", protocol: "chat_completions" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", protocol: "chat_completions" },
      { id: "o3-mini", label: "o3-mini Reasoning", protocol: "chat_completions" },
      { id: "o1", label: "o1 Reasoning", protocol: "chat_completions" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", protocol: "chat_completions" }
    ]
  },
  gemini: {
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", protocol: "chat_completions" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", protocol: "chat_completions" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", protocol: "chat_completions" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", protocol: "chat_completions" }
    ]
  },
  claude: {
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet", protocol: "chat_completions" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", protocol: "chat_completions" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", protocol: "chat_completions" }
    ]
  },
  openrouter: {
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "deepseek/deepseek-r1", label: "DeepSeek R1 (Reasoning)", protocol: "chat_completions" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3", protocol: "chat_completions" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", protocol: "chat_completions" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet via OpenRouter", protocol: "chat_completions" },
      { id: "openai/gpt-4o", label: "GPT-4o via OpenRouter", protocol: "chat_completions" }
    ]
  },
  ollama: {
    defaultBaseUrl: "http://localhost:11434/v1",
    models: [
      { id: "llama3.2", label: "Llama 3.2", protocol: "chat_completions" },
      { id: "mistral", label: "Mistral", protocol: "chat_completions" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder", protocol: "chat_completions" },
      { id: "deepseek-r1:8b", label: "DeepSeek R1 8B", protocol: "chat_completions" }
    ]
  },
  custom: {
    defaultBaseUrl: "https://my-gateway.domain.com/v1",
    models: [
      { id: "custom-model", label: "Custom Model", protocol: "chat_completions" }
    ]
  }
};

let appSettings = { ...DEFAULT_SETTINGS };
let conversationHistory = [];
let activePageTools = [];
let isGenerating = false;
let currentTabId = null;
let agentInstance = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const tabBtnChat = document.getElementById("tabBtnChat");
const tabBtnTools = document.getElementById("tabBtnTools");
const tabBtnSettings = document.getElementById("tabBtnSettings");

const tabContentChat = document.getElementById("tabContentChat");
const tabContentTools = document.getElementById("tabContentTools");
const tabContentSettings = document.getElementById("tabContentSettings");

const toolsStatusBadge = document.getElementById("toolsStatusBadge");
const toolsCountText = document.getElementById("toolsCountText");
const statusDot = toolsStatusBadge?.querySelector(".status-dot");
const quickModelBadge = document.getElementById("quickModelBadge");
const currentModelLabel = document.getElementById("currentModelLabel");

// Chat Elements
const messagesViewport = document.getElementById("messagesViewport");
const welcomeScreen = document.getElementById("welcomeScreen");
const chatInputForm = document.getElementById("chatInputForm");
const chatInputText = document.getElementById("chatInputText");
const btnSend = document.getElementById("btnSend");
const agentStatusBanner = document.getElementById("agentStatusBanner");
const agentStatusText = document.getElementById("agentStatusText");
const btnStopAgent = document.getElementById("btnStopAgent");
const btnClearChat = document.getElementById("btnClearChat");
const btnCopyChat = document.getElementById("btnCopyChat");

// Inspector Elements
const btnRefreshTools = document.getElementById("btnRefreshTools");
const toolsTableBody = document.getElementById("toolsTableBody");
const manualToolSelect = document.getElementById("manualToolSelect");
const manualToolArgs = document.getElementById("manualToolArgs");
const btnExecuteManualTool = document.getElementById("btnExecuteManualTool");
const manualResultCard = document.getElementById("manualResultCard");
const manualResultPre = document.getElementById("manualResultPre");
const btnCopyManualResult = document.getElementById("btnCopyManualResult");

// Settings Elements
const settingsForm = document.getElementById("settingsForm");
const settingProvider = document.getElementById("settingProvider");
const settingProtocol = document.getElementById("settingProtocol");
const settingBaseUrl = document.getElementById("settingBaseUrl");
const baseUrlHint = document.getElementById("baseUrlHint");
const settingModelSelect = document.getElementById("settingModelSelect");
const settingModelCustom = document.getElementById("settingModelCustom");
const btnFetchModels = document.getElementById("btnFetchModels");
const fetchModelsIcon = document.getElementById("fetchModelsIcon");
const fetchModelsText = document.getElementById("fetchModelsText");
const fetchStatusMsg = document.getElementById("fetchStatusMsg");
const settingApiKey = document.getElementById("settingApiKey");
const btnToggleApiKey = document.getElementById("btnToggleApiKey");
const settingCustomHeaders = document.getElementById("settingCustomHeaders");
const settingSystemPrompt = document.getElementById("settingSystemPrompt");
const settingTemperature = document.getElementById("settingTemperature");
const tempValueDisplay = document.getElementById("tempValueDisplay");
const settingMaxSteps = document.getElementById("settingMaxSteps");
const maxStepsDisplay = document.getElementById("maxStepsDisplay");
const btnResetSettings = document.getElementById("btnResetSettings");
const settingsToast = document.getElementById("settingsToast");

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  setupTabNavigation();
  setupChatHandlers();
  setupInspectorHandlers();
  setupSettingsHandlers();

  await loadSettings();
  agentInstance = new AIAgent(appSettings);

  await initActiveTab();
  await refreshPageTools();
});

function setupTabNavigation() {
  const tabs = [
    { btn: tabBtnChat, content: tabContentChat },
    { btn: tabBtnTools, content: tabContentTools },
    { btn: tabBtnSettings, content: tabContentSettings }
  ];

  tabs.forEach(({ btn, content }) => {
    btn?.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.btn.classList.remove("active");
        t.content.classList.remove("active");
      });
      btn.classList.add("active");
      content.classList.add("active");

      if (btn === tabBtnTools) {
        refreshPageTools();
      }
    });
  });

  quickModelBadge?.addEventListener("click", () => {
    tabBtnSettings.click();
  });

  toolsStatusBadge?.addEventListener("click", () => {
    refreshPageTools();
  });
}

// ==========================================
// ACTIVE TAB & WEBMCP TOOLS INTERACTION
// ==========================================
function isInternalUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
}

async function getTargetTab() {
  try {
    const normalTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (normalTabs[0] && !isInternalUrl(normalTabs[0].url)) {
      return normalTabs[0];
    }
    const allActive = await chrome.tabs.query({ active: true });
    const webTab = allActive.find((t) => t.url && !isInternalUrl(t.url));
    if (webTab) return webTab;
    return normalTabs[0] || allActive[0] || null;
  } catch (e) {
    console.warn("Error resolving target tab:", e);
    return null;
  }
}

async function initActiveTab() {
  const tab = await getTargetTab();
  if (tab?.id) {
    currentTabId = tab.id;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TAB_CHANGED" || msg.type === "TAB_UPDATED") {
      currentTabId = msg.tabId;
      refreshPageTools();
    }
  });
}

async function refreshPageTools() {
  const tab = await getTargetTab();
  if (tab?.id) {
    currentTabId = tab.id;
  }

  if (!tab || isInternalUrl(tab.url)) {
    if (activePageTools.length > 0) {
      updateToolsUI();
    } else {
      toolsCountText.textContent = "0 Tools (Open a Web Page)";
      statusDot?.classList.remove("active");
    }
    return;
  }

  toolsCountText.textContent = "Checking...";

  try {
    let tools = null;

    try {
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(currentTabId, { type: "GET_TOOLS" }, (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });
      if (response && Array.isArray(response.tools)) {
        tools = response.tools;
      }
    } catch (e) {
      // Non-fatal, try executeScript
    }

    if (!tools && typeof chrome.scripting !== "undefined") {
      try {
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          world: "MAIN",
          func: async () => {
            try {
              if (window.navigator?.modelContextTesting?.listTools) {
                const raw = await window.navigator.modelContextTesting.listTools();
                if (Array.isArray(raw)) {
                  return raw.map((t) => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema
                  }));
                }
              }
              const modelContext = document.modelContext || window.navigator?.modelContext;
              if (modelContext?.getTools) {
                const raw = await modelContext.getTools();
                if (Array.isArray(raw)) {
                  return raw.map((t) => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema
                  }));
                }
              }
            } catch (e) {
              return [];
            }
            return [];
          }
        });

        if (injectionResults && injectionResults[0]?.result) {
          tools = injectionResults[0].result;
        }
      } catch (scriptErr) {
        console.warn("Script injection skipped or restricted:", scriptErr.message);
      }
    }

    if (Array.isArray(tools)) {
      activePageTools = tools.filter((t) => t && t.name);
    }

    updateToolsUI();
  } catch (err) {
    console.warn("Non-fatal tool discovery warning:", err);
    updateToolsUI();
  }
}

async function executePageTool(name, args) {
  const tab = await getTargetTab();
  if (tab?.id) {
    currentTabId = tab.id;
  }
  if (!currentTabId) throw new Error("No active browser tab found.");

  // 1. Try message to content script
  try {
    const msgResult = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        currentTabId,
        { type: "EXECUTE_TOOL", name, args },
        (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve(null);
          } else {
            resolve(res);
          }
        }
      );
    });

    if (msgResult && (msgResult.success || msgResult.result !== undefined)) {
      return msgResult;
    }
  } catch (e) {
    // Continue to MAIN world injection
  }

  // 2. Direct injection into MAIN world of page
  const injection = await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    world: "MAIN",
    func: async (toolName, toolArgs) => {
      const argsJson = typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs || {});
      const argsObj = typeof toolArgs === "string" ? JSON.parse(toolArgs || "{}") : (toolArgs || {});

      // Method 1: document.modelContext.executeTool(RegisteredTool, JSONString)
      // Per W3C WebMCP spec: executeTool expects the RegisteredTool object from getTools(), not a string!
      const docContext = document.modelContext || window.navigator?.modelContext;
      if (docContext && typeof docContext.getTools === "function" && typeof docContext.executeTool === "function") {
        try {
          const registeredTools = await docContext.getTools();
          const targetTool = (registeredTools || []).find((t) => t.name === toolName);
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
          const rawResult = await testingContext.executeTool(toolName, argsJson);
          let parsed = rawResult;
          if (typeof rawResult === "string") {
            try { parsed = JSON.parse(rawResult); } catch (e) { parsed = rawResult; }
          }
          return { success: true, result: parsed !== undefined ? parsed : "Tool executed successfully." };
        } catch (e2) {
          try {
            const rawResult = await testingContext.executeTool(toolName, argsObj);
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
          const targetTool = (registeredTools || []).find((t) => t.name === toolName);
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
          const r = await window.__WEBMCP_EXECUTE_TOOL__(toolName, argsObj);
          return { success: true, result: r };
        } catch (e4) {
          return { success: false, error: e4.message || String(e4) };
        }
      }

      return {
        success: false,
        error: `Tool "${toolName}" could not be executed on this page.`
      };
    },
    args: [name, args]
  });

  if (injection && injection[0]?.result) {
    return injection[0].result;
  }

  throw new Error(`Execution failed for tool ${name}`);
}

function updateToolsUI() {
  const count = activePageTools.length;
  toolsCountText.textContent = `${count} Tool${count === 1 ? "" : "s"}`;

  // Update Chrome Extension Toolbar Icon Badge (matches original extension feature)
  if (typeof chrome !== "undefined" && chrome.action?.setBadgeText) {
    try {
      chrome.action.setBadgeText({
        text: count > 0 ? String(count) : "",
        tabId: currentTabId || undefined
      });
      chrome.action.setBadgeBackgroundColor({
        color: count > 0 ? "#1a73e8" : "#5f6368",
        tabId: currentTabId || undefined
      });
    } catch (e) {
      // Ignore badge update error in background
    }
  }

  if (count > 0) {
    statusDot?.classList.add("active");
  } else {
    statusDot?.classList.remove("active");
  }

  if (toolsTableBody) {
    if (count === 0) {
      toolsTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="table-empty-msg">
            No WebMCP tools found on this page.<br/>
            Make sure the page calls <code>navigator.modelContext.registerTool()</code> and Chrome flag <code>#enable-webmcp-for-testing</code> is enabled.
          </td>
        </tr>`;
    } else {
      toolsTableBody.innerHTML = activePageTools
        .map(
          (t) => `
        <tr>
          <td class="tool-name-cell">${escapeHtml(t.name)}</td>
          <td class="tool-desc-cell">${escapeHtml(t.description || "No description")}</td>
          <td class="tool-schema-cell" title="Double click to toggle compact/expanded">
            <pre class="schema-pre">${escapeHtml(JSON.stringify(t.inputSchema || {}, null, 2))}</pre>
          </td>
        </tr>`
        )
        .join("");

      // Double-click to toggle compact vs pretty JSON (from original extension)
      toolsTableBody.querySelectorAll(".tool-schema-cell").forEach((cell, idx) => {
        cell.addEventListener("dblclick", () => {
          const pre = cell.querySelector("pre");
          const tool = activePageTools[idx];
          if (!pre || !tool) return;
          const isCompact = pre.getAttribute("data-compact") === "true";
          if (isCompact) {
            pre.textContent = JSON.stringify(tool.inputSchema || {}, null, 2);
            pre.setAttribute("data-compact", "false");
          } else {
            pre.textContent = JSON.stringify(tool.inputSchema || {});
            pre.setAttribute("data-compact", "true");
          }
        });
      });
    }
  }

  if (manualToolSelect) {
    manualToolSelect.innerHTML =
      '<option value="">-- Choose a tool --</option>' +
      activePageTools
        .map((t) => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`)
        .join("");
  }
}

// ==========================================
// CHAT AGENT WORKFLOW & UI RENDERING
// ==========================================
function setupChatHandlers() {
  chatInputText?.addEventListener("input", () => {
    chatInputText.style.height = "auto";
    chatInputText.style.height = Math.min(chatInputText.scrollHeight, 120) + "px";
  });

  chatInputText?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatInputForm.dispatchEvent(new Event("submit"));
    }
  });

  chatInputForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = chatInputText.value.trim();
    if (!query || isGenerating) return;

    chatInputText.value = "";
    chatInputText.style.height = "auto";

    await handleUserMessage(query);
  });

  document.querySelectorAll(".quick-prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) {
        chatInputText.value = prompt;
        chatInputForm.dispatchEvent(new Event("submit"));
      }
    });
  });

  btnClearChat?.addEventListener("click", () => {
    if (confirm("Clear conversation history?")) {
      conversationHistory = [];
      renderConversation();
    }
  });

  btnCopyChat?.addEventListener("click", () => {
    const traceText = conversationHistory
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content || JSON.stringify(m)}`)
      .join("\n\n");
    navigator.clipboard.writeText(traceText).then(() => {
      btnCopyChat.querySelector("span").textContent = "Copied!";
      setTimeout(() => {
        btnCopyChat.querySelector("span").textContent = "Copy Trace";
      }, 2000);
    });
  });

  btnStopAgent?.addEventListener("click", () => {
    isGenerating = false;
    if (agentInstance) {
      agentInstance.abort();
    }
    hideAgentStatus();
  });
}

async function handleUserMessage(userText) {
  welcomeScreen.classList.add("hidden");

  conversationHistory.push({
    role: "user",
    content: userText,
    timestamp: Date.now()
  });

  appendMessageBubble("user", userText);
  const assistantBubbleInfo = createAssistantBubble();

  isGenerating = true;
  showAgentStatus("Agent is thinking...");

  try {
    agentInstance.updateConfig(appSettings);

    const finalAnswer = await agentInstance.runTurn(
      conversationHistory,
      activePageTools,
      async (toolName, toolArgs) => {
        return await executePageTool(toolName, toolArgs);
      },
      (event) => {
        handleAgentEvent(event, assistantBubbleInfo);
      }
    );

    const textToRender = (finalAnswer && finalAnswer.trim()) 
      ? finalAnswer 
      : "*(The model finished responding without additional text)*";

    conversationHistory.push({
      role: "assistant",
      content: textToRender,
      timestamp: Date.now()
    });

    assistantBubbleInfo.contentEl.innerHTML = renderMarkdown(textToRender);
    attachCodeCopyListeners(assistantBubbleInfo.contentEl);
  } catch (err) {
    const errorMsg = err.message || String(err);
    assistantBubbleInfo.contentEl.innerHTML = `
      <div class="tool-status-pill error" style="margin-top: 8px;">
        ⚠️ Error: ${escapeHtml(errorMsg)}
      </div>`;
  } finally {
    isGenerating = false;
    hideAgentStatus();
    scrollToBottom();
  }
}

function handleAgentEvent(event, bubbleInfo) {
  if (event.type === "status") {
    agentStatusText.textContent = event.status;
  } else if (event.type === "tool_start") {
    showAgentStatus(`Executing tool: ${event.toolName}...`);

    const cardId = `tool_card_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toolCard = document.createElement("div");
    toolCard.className = "tool-call-card";
    toolCard.id = cardId;
    toolCard.innerHTML = `
      <div class="tool-call-header">
        <div class="tool-call-title">
          <span>⚙️ Tool:</span>
          <span class="tool-badge">${escapeHtml(event.toolName)}</span>
        </div>
        <div class="tool-status-pill running">Running...</div>
      </div>
      <div class="tool-call-body">
        <div class="tool-detail-label">Arguments:</div>
        <pre class="tool-detail-pre">${escapeHtml(JSON.stringify(event.args, null, 2))}</pre>
        <div class="tool-output-block hidden">
          <div class="tool-detail-label">Result:</div>
          <pre class="tool-detail-pre output-pre"></pre>
        </div>
      </div>
    `;

    const headerEl = toolCard.querySelector(".tool-call-header");
    const bodyEl = toolCard.querySelector(".tool-call-body");
    headerEl.addEventListener("click", () => {
      bodyEl.classList.toggle("collapsed");
    });

    bubbleInfo.toolsContainer.appendChild(toolCard);
    bubbleInfo.toolCards[event.toolName] = toolCard;
    scrollToBottom();
  } else if (event.type === "tool_end") {
    showAgentStatus(`Finished ${event.toolName}`);

    const toolCard = bubbleInfo.toolCards[event.toolName];
    if (toolCard) {
      const statusPill = toolCard.querySelector(".tool-status-pill");
      const outputBlock = toolCard.querySelector(".tool-output-block");
      const outputPre = toolCard.querySelector(".output-pre");

      outputBlock.classList.remove("hidden");

      if (event.error) {
        statusPill.className = "tool-status-pill error";
        statusPill.textContent = "Failed";
        outputPre.textContent = String(event.error);
      } else {
        statusPill.className = "tool-status-pill success";
        statusPill.textContent = "Completed";
        outputPre.textContent = typeof event.result === "string" ? event.result : JSON.stringify(event.result, null, 2);
      }
    }
    scrollToBottom();
  }
}

function createAssistantBubble() {
  const row = document.createElement("div");
  row.className = "chat-row assistant";

  row.innerHTML = `
    <div class="avatar agent-avatar" title="WebMCP Agent">AI</div>
    <div class="message-bubble">
      <div class="tools-container"></div>
      <div class="markdown-body"><div class="status-spinner"></div></div>
      <div class="msg-actions">
        <button class="msg-action-btn btn-copy-msg" title="Copy response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    </div>
  `;

  messagesViewport.appendChild(row);
  scrollToBottom();

  const contentEl = row.querySelector(".markdown-body");
  const toolsContainer = row.querySelector(".tools-container");
  const copyBtn = row.querySelector(".btn-copy-msg");

  copyBtn.addEventListener("click", () => {
    const textToCopy = contentEl.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyBtn.querySelector("span").textContent = "Copied!";
      setTimeout(() => (copyBtn.querySelector("span").textContent = "Copy"), 2000);
    });
  });

  return {
    rowEl: row,
    contentEl,
    toolsContainer,
    toolCards: {}
  };
}

function appendMessageBubble(role, content) {
  const row = document.createElement("div");
  row.className = `chat-row ${role}`;

  if (role === "user") {
    row.innerHTML = `
      <div class="message-bubble">${escapeHtml(content)}</div>
      <div class="avatar user-avatar" title="You">U</div>
    `;
  }

  messagesViewport.appendChild(row);
  scrollToBottom();
}

function renderConversation() {
  messagesViewport.innerHTML = "";
  if (conversationHistory.length === 0) {
    welcomeScreen.classList.remove("hidden");
    messagesViewport.appendChild(welcomeScreen);
    return;
  }

  welcomeScreen.classList.add("hidden");

  for (const msg of conversationHistory) {
    if (msg.role === "user") {
      appendMessageBubble("user", msg.content);
    } else if (msg.role === "assistant") {
      const bubble = createAssistantBubble();
      bubble.contentEl.innerHTML = renderMarkdown(msg.content);
      attachCodeCopyListeners(bubble.contentEl);
    }
  }

  scrollToBottom();
}

function attachCodeCopyListeners(container) {
  container.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const code = decodeURIComponent(btn.getAttribute("data-code") || "");
      navigator.clipboard.writeText(code).then(() => {
        const span = btn.querySelector("span");
        if (span) span.textContent = "Copied!";
        setTimeout(() => {
          if (span) span.textContent = "Copy";
        }, 2000);
      });
    });
  });
}

function showAgentStatus(text) {
  agentStatusBanner.classList.remove("hidden");
  agentStatusText.textContent = text;
  btnSend.disabled = true;
}

function hideAgentStatus() {
  agentStatusBanner.classList.add("hidden");
  btnSend.disabled = false;
}

function scrollToBottom() {
  messagesViewport.scrollTop = messagesViewport.scrollHeight;
}

// ==========================================
// MANUAL INSPECTOR TAB HANDLERS
// ==========================================
function setupInspectorHandlers() {
  btnRefreshTools?.addEventListener("click", async () => {
    await refreshPageTools();
  });

  manualToolSelect?.addEventListener("change", () => {
    const selectedName = manualToolSelect.value;
    const tool = activePageTools.find((t) => t.name === selectedName);
    if (tool && tool.inputSchema) {
      const sample = {};
      const props = tool.inputSchema.properties || {};
      for (const [key, val] of Object.entries(props)) {
        if (val.type === "string") sample[key] = "example_string";
        else if (val.type === "number" || val.type === "integer") sample[key] = 1;
        else if (val.type === "boolean") sample[key] = true;
        else sample[key] = {};
      }
      manualToolArgs.value = JSON.stringify(sample, null, 2);
    } else {
      manualToolArgs.value = "{}";
    }
  });

  btnExecuteManualTool?.addEventListener("click", async () => {
    const toolName = manualToolSelect.value;
    if (!toolName) {
      alert("Please select a tool to execute.");
      return;
    }

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(manualToolArgs.value || "{}");
    } catch (e) {
      alert("Invalid JSON in Input Arguments: " + e.message);
      return;
    }

    btnExecuteManualTool.disabled = true;
    manualResultCard.classList.remove("hidden");
    manualResultPre.textContent = "Executing...";

    try {
      const res = await executePageTool(toolName, parsedArgs);
      manualResultPre.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      manualResultPre.textContent = "Error: " + (err.message || String(err));
    } finally {
      btnExecuteManualTool.disabled = false;
    }
  });

  btnCopyManualResult?.addEventListener("click", () => {
    navigator.clipboard.writeText(manualResultPre.textContent).then(() => {
      btnCopyManualResult.textContent = "Copied!";
      setTimeout(() => (btnCopyManualResult.textContent = "Copy"), 2000);
    });
  });

  // Original extension feature: Copy full tools list as JSON
  document.getElementById("btnCopyToolsJson")?.addEventListener("click", () => {
    const jsonStr = JSON.stringify(activePageTools, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      const btn = document.getElementById("btnCopyToolsJson");
      btn.querySelector("span").textContent = "✓ Copied JSON!";
      setTimeout(() => {
        btn.querySelector("span").textContent = "📋 Copy as JSON";
      }, 2000);
    });
  });

  // Original extension feature: Copy as ScriptToolConfig
  document.getElementById("btnCopyScriptToolConfig")?.addEventListener("click", () => {
    const scriptConfig = {
      tools: activePageTools.map((t) => ({
        functionDeclarations: [
          {
            name: t.name,
            description: t.description || "",
            parameters: t.inputSchema || { type: "object", properties: {} }
          }
        ]
      }))
    };
    const configStr = JSON.stringify(scriptConfig, null, 2);
    navigator.clipboard.writeText(configStr).then(() => {
      const btn = document.getElementById("btnCopyScriptToolConfig");
      btn.querySelector("span").textContent = "✓ Copied Config!";
      setTimeout(() => {
        btn.querySelector("span").textContent = "📋 Copy as ScriptToolConfig";
      }, 2000);
    });
  });
}

// ==========================================
// SETTINGS HANDLERS (MULTI-MODEL & GATEWAYS)
// ==========================================
function setupSettingsHandlers() {
  settingProvider?.addEventListener("change", () => {
    updateProviderSettingsUI(settingProvider.value);
  });

  // When model selection changes in dropdown, auto-detect protocol and sync custom input
  settingModelSelect?.addEventListener("change", () => {
    const selectedModelId = settingModelSelect.value;
    settingModelCustom.value = selectedModelId;

    // Check if the selected option specifies a protocol
    const selectedOption = settingModelSelect.options[settingModelSelect.selectedIndex];
    const protocolHint = selectedOption?.getAttribute("data-protocol");

    if (protocolHint === "responses" || selectedModelId.includes("muse-spark") || selectedModelId.includes("gpt-5.6-sol")) {
      settingProtocol.value = "responses";
    } else if (protocolHint === "chat_completions") {
      settingProtocol.value = "chat_completions";
    } else {
      settingProtocol.value = "auto";
    }
  });

  // Dynamic Fetch Live Models from OpenCode API
  btnFetchModels?.addEventListener("click", async () => {
    await fetchLiveOpenCodeModels();
  });

  settingTemperature?.addEventListener("input", () => {
    tempValueDisplay.textContent = settingTemperature.value;
  });

  settingMaxSteps?.addEventListener("input", () => {
    maxStepsDisplay.textContent = settingMaxSteps.value;
  });

  btnToggleApiKey?.addEventListener("click", () => {
    if (settingApiKey.type === "password") {
      settingApiKey.type = "text";
      btnToggleApiKey.textContent = "🔒";
    } else {
      settingApiKey.type = "password";
      btnToggleApiKey.textContent = "👁️";
    }
  });

  settingsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    let customHeaders = {};
    try {
      const rawHeaders = settingCustomHeaders.value.trim();
      if (rawHeaders) {
        customHeaders = JSON.parse(rawHeaders);
      }
    } catch (err) {
      alert("Invalid JSON format in Custom HTTP Headers: " + err.message);
      return;
    }

    appSettings = {
      provider: settingProvider.value,
      apiProtocol: settingProtocol.value,
      baseUrl: settingBaseUrl.value.trim(),
      model: settingModelCustom.value.trim() || settingModelSelect.value,
      apiKey: settingApiKey.value.trim(),
      customHeaders,
      systemPrompt: settingSystemPrompt.value.trim(),
      temperature: parseFloat(settingTemperature.value),
      maxSteps: parseInt(settingMaxSteps.value, 10)
    };

    await saveSettings();
    if (agentInstance) {
      agentInstance.updateConfig(appSettings);
    }

    currentModelLabel.textContent = appSettings.model || appSettings.provider;

    settingsToast.classList.remove("hidden");
    setTimeout(() => {
      settingsToast.classList.add("hidden");
    }, 2500);
  });

  btnResetSettings?.addEventListener("click", async () => {
    if (confirm("Reset all settings to default values?")) {
      appSettings = { ...DEFAULT_SETTINGS };
      await saveSettings();
      populateSettingsForm();
    }
  });
}

/**
 * Dynamically query the OpenCode API for live models
 */
async function fetchLiveOpenCodeModels() {
  const apiKey = settingApiKey.value.trim();
  if (!apiKey) {
    showFetchStatus("Please enter your OpenCode API Key first.", "error");
    return;
  }

  let baseUrl = settingBaseUrl.value.trim() || "https://opencode.ai/zen/v1";
  baseUrl = baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "").replace(/\/responses$/, "");
  const modelsUrl = `${baseUrl}/models`;

  fetchModelsIcon.textContent = "⏳";
  fetchModelsText.textContent = "Fetching...";
  btnFetchModels.disabled = true;
  showFetchStatus("Querying OpenCode models catalog...", "normal");

  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    let rawList = [];

    if (Array.isArray(json)) {
      rawList = json;
    } else if (Array.isArray(json.data)) {
      rawList = json.data;
    } else if (Array.isArray(json.models)) {
      rawList = json.models;
    }

    if (rawList.length === 0) {
      throw new Error("No models returned in API response.");
    }

    // Populate dropdown with fetched models
    settingModelSelect.innerHTML = "";
    rawList.forEach((m) => {
      const modelId = typeof m === "string" ? m : (m.id || m.name);
      const isResponses = modelId.includes("muse-spark") || modelId.includes("gpt-5.6-sol");
      const isFree = modelId.includes("free") || modelId === "big-pickle";
      const badge = isFree ? "🌟 [FREE]" : (isResponses ? "⚡ [Responses]" : "⚡");
      
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = `${badge} ${m.name || modelId}`;
      opt.setAttribute("data-protocol", isResponses ? "responses" : "chat_completions");
      settingModelSelect.appendChild(opt);
    });

    showFetchStatus(`✅ Successfully fetched ${rawList.length} live models from OpenCode!`, "success");
    settingModelSelect.dispatchEvent(new Event("change"));
  } catch (err) {
    console.warn("Live fetch failed, keeping preconfigured list:", err);
    showFetchStatus(`⚠️ Live fetch error (${err.message}). Kept preconfigured catalog.`, "error");
  } finally {
    fetchModelsIcon.textContent = "🔄";
    fetchModelsText.textContent = "Fetch Live Models";
    btnFetchModels.disabled = false;
  }
}

function showFetchStatus(text, type) {
  fetchStatusMsg.textContent = text;
  fetchStatusMsg.className = `model-fetch-status ${type}`;
  fetchStatusMsg.classList.remove("hidden");
  setTimeout(() => {
    if (type === "success") {
      fetchStatusMsg.classList.add("hidden");
    }
  }, 4000);
}

function updateProviderSettingsUI(provider) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;

  baseUrlHint.textContent = `(Default: ${preset.defaultBaseUrl})`;
  if (!settingBaseUrl.value || Object.values(PROVIDER_PRESETS).some((p) => p.defaultBaseUrl === settingBaseUrl.value)) {
    settingBaseUrl.value = preset.defaultBaseUrl;
  }

  settingModelSelect.innerHTML = preset.models
    .map((m) => {
      const id = typeof m === "string" ? m : m.id;
      const label = typeof m === "string" ? m : m.label;
      const protocol = m.protocol || "chat_completions";
      return `<option value="${id}" data-protocol="${protocol}">${label}</option>`;
    })
    .join("");

  const firstModel = preset.models[0];
  const firstId = typeof firstModel === "string" ? firstModel : firstModel.id;
  settingModelCustom.value = firstId || "";

  // Show or hide the Fetch Models button for OpenCode
  if (provider === "opencode" || provider === "custom") {
    btnFetchModels.style.display = "inline-flex";
  } else {
    btnFetchModels.style.display = "none";
  }
}

function populateSettingsForm() {
  settingProvider.value = appSettings.provider || "opencode";
  updateProviderSettingsUI(appSettings.provider || "opencode");

  if (settingProtocol) {
    settingProtocol.value = appSettings.apiProtocol || "auto";
  }

  settingBaseUrl.value = appSettings.baseUrl || PROVIDER_PRESETS[appSettings.provider]?.defaultBaseUrl || "";
  settingModelCustom.value = appSettings.model || "big-pickle";
  settingModelSelect.value = appSettings.model || "big-pickle";
  settingApiKey.value = appSettings.apiKey || "";
  settingCustomHeaders.value =
    appSettings.customHeaders && Object.keys(appSettings.customHeaders).length > 0
      ? JSON.stringify(appSettings.customHeaders, null, 2)
      : "";
  settingSystemPrompt.value = appSettings.systemPrompt;
  settingTemperature.value = appSettings.temperature;
  tempValueDisplay.textContent = appSettings.temperature;
  settingMaxSteps.value = appSettings.maxSteps;
  maxStepsDisplay.textContent = appSettings.maxSteps;

  currentModelLabel.textContent = appSettings.model || appSettings.provider;
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(["webmcp_agent_settings", "webmcp_chat_history"]);
    if (data && data.webmcp_agent_settings) {
      appSettings = { ...DEFAULT_SETTINGS, ...data.webmcp_agent_settings };
    }
    if (data && Array.isArray(data.webmcp_chat_history)) {
      conversationHistory = data.webmcp_chat_history;
      renderConversation();
    }
  } catch (err) {
    console.warn("Could not load stored settings:", err);
  }
  populateSettingsForm();
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      webmcp_agent_settings: appSettings,
      webmcp_chat_history: conversationHistory
    });
  } catch (err) {
    console.warn("Could not save settings to storage:", err);
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
