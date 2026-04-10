import type { AgentsConfig, AgentInstance, AgentMessage, AgentStderr } from "./types";
import {
  Quit,
  WindowIsMaximised,
  WindowMinimise,
  WindowToggleMaximise,
} from "../../wailsjs/runtime/runtime";

export type UnlistenFn = () => void;

type RuntimeAPI = {
  EventsOn?: (eventName: string, callback: (payload: unknown) => void) => UnlistenFn | void;
};

type AppBinding = Record<string, (...args: unknown[]) => Promise<unknown> | unknown>;

function getRuntime(): RuntimeAPI {
  return (window as unknown as { runtime?: RuntimeAPI }).runtime ?? {};
}

function getAppBinding(): AppBinding {
  const go = (window as unknown as { go?: Record<string, unknown> }).go;
  const binding =
    (go?.app as { App?: AppBinding } | undefined)?.App ??
    (go?.main as { App?: AppBinding } | undefined)?.App;
  if (!binding) {
    throw new Error("Wails App binding not found. Ensure app is started with Wails.");
  }
  return binding;
}

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const binding = getAppBinding();
  const fn = binding[method];
  if (typeof fn !== "function") {
    throw new Error(`Wails method not found: ${method}`);
  }
  return (await fn(...args)) as T;
}

function listenEvent<T>(
  eventName: string,
  transform: (payload: unknown) => T,
  callback: (value: T) => void
): UnlistenFn {
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

function normalizeAgentMessage(payload: unknown): AgentMessage {
  const value = payload as { agent_id?: string; agentId?: string; message?: string };
  return {
    agent_id: value.agent_id ?? value.agentId ?? "",
    message: value.message ?? "",
  };
}

function normalizeAgentStderr(payload: unknown): AgentStderr {
  const value = payload as { agent_id?: string; agentId?: string; line?: string };
  return {
    agent_id: value.agent_id ?? value.agentId ?? "",
    line: value.line ?? "",
  };
}

export async function getConfig(): Promise<AgentsConfig> {
  return call<AgentsConfig>("GetConfig");
}

export async function reloadConfig(): Promise<AgentsConfig> {
  return call<AgentsConfig>("ReloadConfig");
}

export async function getConfigPath(): Promise<string> {
  return call<string>("GetConfigPath");
}

export async function spawnAgent(
  name: string,
  envOverrides: Record<string, string> = {}
): Promise<AgentInstance> {
  return call<AgentInstance>("SpawnAgent", name, envOverrides);
}

export async function sendToAgent(agentId: string, message: string): Promise<void> {
  await call<void>("SendToAgent", agentId, message);
}

export async function killAgent(agentId: string): Promise<void> {
  await call<void>("KillAgent", agentId);
}

export async function listRunningAgents(): Promise<string[]> {
  return call<string[]>("ListRunningAgents");
}

export async function addAgent(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<AgentsConfig> {
  return call<AgentsConfig>("AddAgent", name, command, args, env);
}

export async function removeAgent(name: string): Promise<AgentsConfig> {
  return call<AgentsConfig>("RemoveAgent", name);
}

export async function updateAgent(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<AgentsConfig> {
  return call<AgentsConfig>("UpdateAgent", name, command, args, env);
}

export async function getMachineId(): Promise<string> {
  return call<string>("GetMachineID");
}

export async function getAppVersion(): Promise<string> {
  return call<string>("GetAppVersion");
}

export async function selectDirectory(): Promise<string> {
  return call<string>("SelectDirectory");
}

export async function loadStore(name: string): Promise<Record<string, unknown>> {
  return call<Record<string, unknown>>("LoadStore", name);
}

export async function saveStore(name: string, value: Record<string, unknown>): Promise<void> {
  await call<void>("SaveStore", name, value);
}

export async function readTextFile(
  path: string,
  line?: number | null,
  limit?: number | null
): Promise<string> {
  const normalizedLine = line === undefined ? null : line;
  const normalizedLimit = limit === undefined ? null : limit;
  return call<string>("ReadTextFile", path, normalizedLine, normalizedLimit);
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await call<void>("WriteTextFile", path, content);
}

export async function onAgentMessage(
  callback: (message: AgentMessage) => void
): Promise<UnlistenFn> {
  return listenEvent("agent-message", normalizeAgentMessage, callback);
}

export async function onAgentClosed(
  callback: (agentId: string) => void
): Promise<UnlistenFn> {
  return listenEvent("agent-closed", (payload) => String(payload ?? ""), callback);
}

export async function onConfigChanged(
  callback: (config: AgentsConfig) => void
): Promise<UnlistenFn> {
  return listenEvent("config-changed", (payload) => payload as AgentsConfig, callback);
}

export async function onAgentStderr(
  callback: (stderr: AgentStderr) => void
): Promise<UnlistenFn> {
  return listenEvent("agent-stderr", normalizeAgentStderr, callback);
}

export function windowMinimise(): void {
  WindowMinimise();
}

export function windowClose(): void {
  Quit();
}

export function windowToggleMaximise(): void {
  WindowToggleMaximise();
}

export function windowIsMaximised(): Promise<boolean> {
  return WindowIsMaximised();
}
