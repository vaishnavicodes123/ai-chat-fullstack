const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const errorBanner = document.querySelector("#error-banner");
const currentMode = document.querySelector("#current-mode");
const statusText = document.querySelector("#connection-status");
const statusDot = document.querySelector(".status-dot");

let selectedTemplate = "general";
let history = [];
let busy = false;

const templateLabels = {
  general: "General assistant",
  tutor: "Study tutor",
  coding: "Coding helper",
  writing: "Writing assistant"
};

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("offline");
    statusText.textContent = "Server connected";
    statusDot.classList.add("online");
  } catch {
    statusText.textContent = "Server unavailable";
    statusDot.classList.remove("online");
  }
}
checkHealth();

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}
function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}
function makeMessage(role, content = "") {
  welcome.hidden = true;
  const row = document.createElement("article");
  row.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Y" : "✦";
  const body = document.createElement("div");
  body.className = "message-body";
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Chat Studio";
  const text = document.createElement("div");
  text.className = "message-content";
  text.textContent = content;
  body.append(label, text);
  row.append(avatar, body);
  messagesEl.append(row);
  messagesEl.scrollIntoView({ behavior: "smooth", block: "end" });
  return text;
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  sendButton.textContent = value ? "…" : "↑";
  input.disabled = value;
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || busy) {
    if (!message) showError("Please type a message before sending.");
    return;
  }
  clearError();
  makeMessage("user", message);
  const previousHistory = history.slice(-10);
  history.push({ role: "user", content: message });
  input.value = "";
  input.style.height = "auto";
  setBusy(true);

  let assistantText = "";
  let output;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        template: selectedTemplate,
        history: previousHistory
      })
    });

    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch {}
      throw new Error(data.error || `Request failed (${response.status}). Please try again.`);
    }

    output = makeMessage("assistant", "");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      output.textContent = assistantText;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    assistantText += decoder.decode();
    output.textContent = assistantText || "I didn't receive any text. Please try again.";
    if (assistantText) history.push({ role: "assistant", content: assistantText });
  } catch (error) {
    if (output && assistantText) {
      output.textContent = assistantText + "\n\n[The stream stopped early. You can ask me to continue.]";
      history.push({ role: "assistant", content: assistantText });
    } else {
      showError(error.message || "Something went wrong. Please try again.");
      if (history.at(-1)?.role === "user") history.pop();
    }
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  clearError();
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".template").forEach(button => {
  button.addEventListener("click", () => {
    selectedTemplate = button.dataset.template;
    document.querySelectorAll(".template").forEach(item => item.classList.toggle("active", item === button));
    currentMode.textContent = templateLabels[selectedTemplate];
  });
});

document.querySelectorAll(".suggestions button").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  });
});

document.querySelector("#new-chat").addEventListener("click", () => {
  history = [];
  messagesEl.replaceChildren();
  welcome.hidden = false;
  clearError();
  input.value = "";
  input.focus();
});

