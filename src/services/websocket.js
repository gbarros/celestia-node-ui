import { updateAllNodeInfo } from '../components/nodeInfo/nodeInfo.js';

// Configuration for the Celestia node
const CELESTIA_NODE_URL = 'ws://localhost:26658';
const CELESTIA_NODE_AUTH = ''; // No auth as specified in the command (--rpc.skip-auth)

// WebSocket connection state
let ws = null;
let requestId = 1;
let pendingRequests = {};
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

/**
 * Connect to the Celestia node WebSocket
 */
export function connectWebSocket() {
  if (ws !== null) {
    return; // Already connected or connecting
  }
  
  try {
    // Using the browser's native WebSocket API
    ws = new WebSocket(CELESTIA_NODE_URL);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      isConnected = true;
      reconnectAttempts = 0;
      
      // Notify UI that connection is established
      const connectionStatus = document.getElementById('connectionStatus');
      if (connectionStatus) {
        connectionStatus.classList.remove('text-danger', 'text-warning');
        connectionStatus.classList.add('text-success');
        connectionStatus.textContent = 'Connected to Celestia node via WebSocket';
      }
      
      // Hide the connection alert since we're connected
      const nodeConnectionAlert = document.getElementById('nodeConnectionAlert');
      if (nodeConnectionAlert) {
        nodeConnectionAlert.style.display = 'none';
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        
        // If this is a response to a pending request
        if (response.id && pendingRequests[response.id]) {
          const { resolve, reject } = pendingRequests[response.id];
          
          if (response.error) {
            reject(new Error(response.error.message || 'Unknown error'));
          } else {
            resolve(response);
          }
          
          // Clean up the pending request
          delete pendingRequests[response.id];
        } else {
          // Handle subscription messages or other unexpected messages
          console.log('Received message:', response);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnected = false;
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      ws = null;
      
      // Attempt to reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * reconnectAttempts, 5000);
        console.log(`Attempting to reconnect in ${delay}ms...`);
        
        setTimeout(connectWebSocket, delay);
      } else {
        console.error('Failed to reconnect after multiple attempts');
        
        // Update UI to show disconnected state
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
          connectionStatus.classList.remove('text-success');
          connectionStatus.classList.add('text-danger');
          connectionStatus.innerHTML = 'Disconnected from Celestia node';
        }
        
        // Show the connection alert
        const nodeConnectionAlert = document.getElementById('nodeConnectionAlert');
        if (nodeConnectionAlert) {
          nodeConnectionAlert.style.display = 'block';
        }
        
        // Update all node information to show error states
        updateAllNodeInfo();
      }
    };
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
    ws = null;
  }
}

/**
 * Send an RPC request over the WebSocket connection
 * @param {string} method - The RPC method to call
 * @param {Array} params - The parameters for the RPC method
 * @returns {Promise} - A promise that resolves with the response
 */
export async function sendRpcRequest(method, params = []) {
  if (!isConnected) {
    let connectionTimeout = false;
    
    // Set a 1-second timeout for connection attempts
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        connectionTimeout = true;
        reject(new Error('Connection timeout: Unable to connect to Celestia node. Please start your node with:\ncelestia light start --p2p.network mammoth --core.ip global.grpc.mamochain.com --core.port 9090 --rpc.skip-auth'));
      }, 1000);
    });
    
    const connectionPromise = new Promise((resolve) => {
      const checkConnection = () => {
        if (connectionTimeout) return; // Stop checking if timeout occurred
        
        if (isConnected) {
          resolve();
        } else {
          connectWebSocket();
          setTimeout(checkConnection, 500);
        }
      };
      checkConnection();
    });
    
    // Race between connection and timeout
    await Promise.race([connectionPromise, timeoutPromise]);
  }
  
  const id = requestId++;
  const payload = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  
  return new Promise((resolve, reject) => {
    try {
      if (!isConnected) {
        throw new Error('Not connected to Celestia node');
      }
      
      pendingRequests[id] = { resolve, reject };
      ws.send(JSON.stringify(payload));
    } catch (error) {
      delete pendingRequests[id];
      reject(error);
    }
  });
}

/**
 * Check if the WebSocket is connected
 * @returns {boolean} - True if connected, false otherwise
 */
export function getConnectionStatus() {
  return isConnected;
}
