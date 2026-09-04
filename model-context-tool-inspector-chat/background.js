// background.js - Service Worker for WebMCP AI Chat Agent

// Enable side panel opening on extension icon click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn("Failed to set side panel behavior:", err);
  });
}

// When active tab changes or updates, inform the sidebar to refresh WebMCP tools
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    chrome.runtime.sendMessage({
      type: "TAB_CHANGED",
      tabId: activeInfo.tabId
    }).catch(() => {}); // Sidebar might not be open, ignore error
  } catch (e) {
    // Ignore
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    try {
      chrome.runtime.sendMessage({
        type: "TAB_UPDATED",
        tabId: tabId
      }).catch(() => {});
    } catch (e) {
      // Ignore
    }
  }
});

// Relay tool execution or fallback execution if required
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "OK" });
    return true;
  }
});
