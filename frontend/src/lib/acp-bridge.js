// ACP Client Bridge - Adapts Wails IPC to ACP SDK
import { readTextFile, writeTextFile, sendToAgent, onAgentMessage, killAgent } from './wails';
import { ref } from 'vue';
import { useTrafficStore } from '../stores/traffic';

// Traffic store instance (lazily initialized)
let trafficStore = null;
function getTrafficStore() {
  if (!trafficStore) {
    trafficStore = useTrafficStore();
  }
  return trafficStore;
}

export class AcpClientBridge {
  constructor(agentId) {
    this.agentId = agentId;
    this.messageResolvers = new Map();
    this.messageRejecters = new Map();
    this.pendingMethods = new Map(); // Track method names for responses
    this.nextRequestId = 0;
    this.unlistenMessage = null;

    // Permission request handling
    this.pendingPermissionRequest = ref(null);
    this.permissionResolver = null;

    // Session update callback
    this.onSessionUpdate = null;
  }

  formatJsonRpcError(error) {
    const code = typeof error.code === 'number' ? ` (${error.code})` : '';
    const message = error.message?.trim() || 'Unknown error';
    const details =
      error.data === undefined
        ? ''
        : `: ${typeof error.data === 'string' ? error.data : JSON.stringify(error.data)}`;
    return new Error(`${message}${code}${details}`);
  }

  async connect() {
    this.unlistenMessage = await onAgentMessage((msg) => {
      if (msg.agent_id === this.agentId) {
        this.handleMessage(msg.message);
      }
    });
  }

  async disconnect() {
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }
    await killAgent(this.agentId);
  }

  handleMessage(message) {
    try {
      const parsed = JSON.parse(message);
      const store = getTrafficStore();
      
      // Handle JSON-RPC response (has id and result/error, no method)
      if ('id' in parsed && parsed.id !== undefined && !('method' in parsed)) {
        // Track incoming response
        store.addEntry({
          direction: 'in',
          type: 'response',
          method: this.pendingMethods.get(parsed.id) || 'unknown',
          requestId: parsed.id,
          payload: parsed,
          error: !!parsed.error,
        });
        this.pendingMethods.delete(parsed.id);
        
        const resolver = this.messageResolvers.get(parsed.id);
        const rejecter = this.messageRejecters.get(parsed.id);
        if (resolver && rejecter) {
          this.messageResolvers.delete(parsed.id);
          this.messageRejecters.delete(parsed.id);
          if (parsed.error) {
            console.error('JSON-RPC error:', parsed.error);
            rejecter(this.formatJsonRpcError(parsed.error));
          } else {
            resolver(parsed.result);
          }
        }
      }
      
      // Handle JSON-RPC request from agent (has id and method)
      if ('id' in parsed && parsed.id !== undefined && 'method' in parsed) {
        // Track incoming request from agent
        store.addEntry({
          direction: 'in',
          type: 'request',
          method: parsed.method,
          requestId: parsed.id,
          payload: parsed,
        });
        this.handleRequest(parsed.id, parsed.method, parsed.params);
      }
      
      // Handle JSON-RPC notification (no id, has method)
      if (!('id' in parsed) && parsed.method) {
        // Track incoming notification
        store.addEntry({
          direction: 'in',
          type: 'notification',
          method: parsed.method,
          payload: parsed,
        });
        this.handleNotification(parsed.method, parsed.params);
      }
    } catch (e) {
      console.error('Failed to parse message:', message, e);
    }
  }

  async handleRequest(id, method, params) {
    let result;
    let error;

    try {
      switch (method) {
        case 'fs/read_text_file':
          result = await this.readTextFile(params);
          break;
        case 'fs/write_text_file':
          result = await this.writeTextFile(params);
          break;
        case 'session/request_permission':
          result = await this.requestPermission(params);
          break;
        default:
          error = { code: -32601, message: `Method not found: ${method}` };
      }
    } catch (e) {
      error = { code: -32603, message: e instanceof Error ? e.message : String(e) };
    }

    // Send response back to agent
    const response = error
      ? { jsonrpc: '2.0', id, error }
      : { jsonrpc: '2.0', id, result };
    
    // Track outgoing response
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'response',
      method,
      requestId: id,
      payload: response,
      error: !!error,
    });
    
    await sendToAgent(this.agentId, JSON.stringify(response));
  }

  handleNotification(method, params) {
    if (method === 'session/update') {
      if (this.onSessionUpdate) {
        this.onSessionUpdate(params);
      }
    }
  }

  getRequestTimeoutMs(method) {
    switch (method) {
      case 'session/prompt':
        return null;
      case 'initialize':
      case 'authenticate':
      case 'session/new':
      case 'session/load':
        return 180000;
      default:
        return 60000;
    }
  }

  async sendRequest(method, params) {
    const id = this.nextRequestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    // Track outgoing request
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'request',
      method,
      requestId: id,
      payload: request,
    });
    this.pendingMethods.set(id, method);

    console.log('Sending request:', request);

    return new Promise((resolve, reject) => {
      const timeoutMs = this.getRequestTimeoutMs(method);
      this.messageResolvers.set(id, (response) => {
        resolve(response);
      });
      this.messageRejecters.set(id, reject);

      sendToAgent(this.agentId, JSON.stringify(request)).catch((e) => {
        this.messageResolvers.delete(id);
        this.messageRejecters.delete(id);
        this.pendingMethods.delete(id);
        reject(e);
      });

      if (timeoutMs !== null) {
        setTimeout(() => {
          if (this.messageResolvers.has(id)) {
            this.messageResolvers.delete(id);
            this.messageRejecters.delete(id);
            this.pendingMethods.delete(id);
            reject(new Error(`Request timeout: ${method}`));
          }
        }, timeoutMs);
      }
    });
  }

  async sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params: params || {},
    };
    
    // Track outgoing notification
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'notification',
      method,
      payload: notification,
    });
    
    await sendToAgent(this.agentId, JSON.stringify(notification));
  }

  // ACP Agent methods (client calls these to talk to agent)
  async initialize(params) {
    return this.sendRequest('initialize', params);
  }

  async newSession(params) {
    return this.sendRequest('session/new', params);
  }

  async loadSession(params) {
    return this.sendRequest('session/load', params);
  }

  async prompt(params) {
    return this.sendRequest('session/prompt', params);
  }

  async cancel(params) {
    await this.sendNotification('session/cancel', params);
  }

  async setMode(params) {
    await this.sendRequest('session/set_mode', params);
  }

  async unstable_setSessionModel(params) {
    await this.sendRequest('session/set_model', params);
  }

  async authenticate(params) {
    return this.sendRequest('authenticate', params);
  }

  // ACP Client interface methods (agent calls these)
  async requestPermission(params) {
    return new Promise((resolve) => {
      this.pendingPermissionRequest.value = {
        sessionId: params.sessionId,
        toolCall: {
          toolCallId: params.toolCall.toolCallId,
          title: params.toolCall.title ?? '',
          kind: params.toolCall.kind ?? 'other',
          status: params.toolCall.status ?? 'pending',
          locations: params.toolCall.locations ?? undefined,
        },
        options: params.options.map((opt) => ({
          kind: opt.kind,
          name: opt.name,
          optionId: opt.optionId,
        })),
      };
      this.permissionResolver = resolve;
    });
  }

  resolvePermission(optionId) {
    if (this.permissionResolver) {
      this.permissionResolver({
        outcome: {
          outcome: 'selected',
          optionId,
        },
      });
      this.permissionResolver = null;
      this.pendingPermissionRequest.value = null;
    }
  }

  cancelPermission() {
    if (this.permissionResolver) {
      this.permissionResolver({
        outcome: {
          outcome: 'cancelled',
        },
      });
      this.permissionResolver = null;
      this.pendingPermissionRequest.value = null;
    }
  }

  async sessionUpdate(_params) {
    // This is called by the agent, we handle it in handleNotification
  }

  async writeTextFile(params) {
    try {
      await writeTextFile(params.path, params.content);
      console.log('writeTextFile completed:', params.path);
      return {};
    } catch (e) {
      console.error('writeTextFile failed:', params.path, e);
      throw e;
    }
  }

  async readTextFile(params) {
    try {
      const content = await readTextFile(params.path, params.line, params.limit);
      console.log('readTextFile completed:', params.path);
      return { content };
    } catch (e) {
      console.error('readTextFile failed:', params.path, e);
      throw e;
    }
  }
}

// Factory function to create a connected ACP client
export async function createAcpClient(agentInstance) {
  const client = new AcpClientBridge(agentInstance.id);
  await client.connect();
  return client;
}
