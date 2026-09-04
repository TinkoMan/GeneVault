# WebMCP AI Chat Agent & Model Context Inspector

A next-generation Chrome Extension that turns the **WebMCP Model Context Tool Inspector** into a full-featured, autonomous **AI Chat Agent**.

## 🌟 Key Features & Improvements

1. **Interactive AI Chat Agent Interface**:
   - Replaces the single prompt textarea with a real-time conversational chat interface.
   - Preserves multi-turn conversation memory so you can chat naturally, iterate, and ask follow-up questions.
   - Visual tool execution timeline: whenever an AI model calls a WebMCP tool on the page, interactive cards appear in the chat showing tool name, animated status, collapsible inputs, and live execution outputs.

2. **Rich Markdown & Code Rendering**:
   - No more raw "Notepad"-style plain text dumps!
   - Full Markdown support:
     - Formatted headers (`#`, `##`, `###`)
     - Bold, italics, strikethrough, blockquotes
     - Bulleted lists and numbered step-by-step lists
     - Styled Markdown tables
     - Code blocks with syntax formatting, dark cards, and one-click **"Copy Code"** buttons.
     - One-click **"Copy Message"** and **"Copy Trace"** buttons.

3. **Multi-Model & Custom API Gateway Support**:
   - **OpenAI**: GPT-4o, GPT-4o-mini, o3-mini, o1, GPT-4-Turbo
   - **Google Gemini**: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
   - **Anthropic Claude**: Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku
   - **OpenRouter**: Access hundreds of models including DeepSeek-R1, DeepSeek-V3, Llama 3.3, Qwen 2.5
   - **Ollama / Local LLMs**: Direct connection to `http://localhost:11434/v1` for private local testing
   - **Custom API Gateway**:
     - Custom Base URL / Gateway URL
     - Custom Model Name
     - Custom API Key
     - Custom HTTP Headers (JSON format for enterprise auth / proxies)

4. **Dual Mode (Chat Agent + Developer Inspector)**:
   - **💬 Chat Agent Tab**: Interact with the page naturally via AI.
   - **🛠️ Page Tools Tab**: Inspect discovered WebMCP tools table, schema specifications, and execute manual single-tool calls.
   - **⚙️ Settings Tab**: Configure providers, base URLs, models, system instructions, temperature, and max tool calling steps.

---

## 🚀 Installation Guide

1. Download or unpack this directory.
2. Open Google Chrome and navigate to `chrome://flags/#enable-webmcp-for-testing`.
   - Set the flag to **Enabled** and relaunch Chrome.
3. Open `chrome://extensions/` in Chrome.
4. Toggle on **Developer mode** in the top right corner.
5. Click **Load unpacked** in the top left.
6. Select the `model-context-tool-inspector-chat` folder.
7. Click the Extension icon or open the Side Panel to start chatting with any WebMCP-enabled page!
