function getRuntime() {
  return window.runtime ?? {};
}

function getAppBinding() {
  const go = window.go;
  const binding =
    go?.app?.App ??
    go?.main?.App;
  if (!binding) {
    throw new Error("Wails App binding not found. Ensure app is started with Wails.");
  }
  return binding;
}

async function call(method, ...args) {
  const binding = getAppBinding();
  const fn = binding[method];
  if (typeof fn !== "function") {
    throw new Error(`Wails method not found: ${method}`);
  }
  return await fn(...args);
}

function listenEvent(eventName, transform, callback) {
  const runtime = getRuntime();
  if (!runtime.EventsOn) {
    console.warn(`Wails runtime EventsOn unavailable for event: ${eventName}`);
    return () => undefined;
  }
  const unlisten = runtime.EventsOn(eventName, (payload) => {
    callback(transform(payload));
  });
  return typeof unlisten === "function" ? unlisten : () => undefined;
}

function normalizeAgentMessage(payload) {
  const value = payload;
  return {
    agent_id: value.agent_id ?? value.agentId ?? "",
    message: value.message ?? "",
  };
}

function normalizeAgentStderr(payload) {
  const value = payload;
  return {
    agent_id: value.agent_id ?? value.agentId ?? "",
    line: value.line ?? "",
  };
}

export async function getConfig() {
  return call("GetConfig");
}

export async function reloadConfig() {
  return call("ReloadConfig");
}

export async function getConfigPath() {
  return call("GetConfigPath");
}

export async function spawnAgent(name, envOverrides = {}) {
  return call("SpawnAgent", name, envOverrides);
}

export async function sendToAgent(agentId, message) {
  await call("SendToAgent", agentId, message);
}

export async function killAgent(agentId) {
  await call("KillAgent", agentId);
}

export async function listRunningAgents() {
  return call("ListRunningAgents");
}

export async function addAgent(name, command, args, env = {}) {
  return call("AddAgent", name, command, args, env);
}

export async function removeAgent(name) {
  return call("RemoveAgent", name);
}

export async function updateAgent(name, command, args, env = {}) {
  return call("UpdateAgent", name, command, args, env);
}

export async function getMachineId() {
  return call("GetMachineID");
}

export async function getAppVersion() {
  return call("GetAppVersion");
}

export async function selectDirectory() {
  return call("SelectDirectory");
}

export async function loadStore(name) {
  return call("LoadStore", name);
}

export async function saveStore(name, value) {
  await call("SaveStore", name, value);
}

export async function readTextFile(path, line, limit) {
  const normalizedLine = line === undefined ? null : line;
  const normalizedLimit = limit === undefined ? null : limit;
  return call("ReadTextFile", path, normalizedLine, normalizedLimit);
}

export async function writeTextFile(path, content) {
  await call("WriteTextFile", path, content);
}

export async function onAgentMessage(callback) {
  return listenEvent("agent-message", normalizeAgentMessage, callback);
}

export async function onAgentClosed(callback) {
  return listenEvent("agent-closed", (payload) => String(payload ?? ""), callback);
}

export async function onConfigChanged(callback) {
  return listenEvent("config-changed", (payload) => payload, callback);
}

export async function onAgentStderr(callback) {
  return listenEvent("agent-stderr", normalizeAgentStderr, callback);
}

export function windowMinimise() {
  getRuntime().WindowMinimise?.();
}

export function windowClose() {
  getRuntime().Quit?.();
}

export function windowToggleMaximise() {
  getRuntime().WindowToggleMaximise?.();
}

export function windowIsMaximised() {
  return getRuntime().WindowIsMaximised?.() ?? Promise.resolve(false);
}
