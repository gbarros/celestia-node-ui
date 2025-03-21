import axios from 'axios';
import { Buffer } from 'buffer';

// Configuration for the Celestia node
const CELESTIA_NODE_URL = 'ws://localhost:26658';
const CELESTIA_NODE_AUTH = ''; // No auth as specified in the command (--rpc.skip-auth)

// Initialize WebSocket connection
let ws = null;
let requestId = 1;
let pendingRequests = {};
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
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
          connectionStatus.innerHTML = 'Disconnected from Celestia node<div class="mt-2 small">To connect, please start your node with:<br><code>celestia light start --p2p.network mocha --core.ip rpc-mocha.pops.one --core.port 9090 --rpc.skip-auth</code></div>';
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

// Connect to WebSocket when the page loads
window.addEventListener('DOMContentLoaded', connectWebSocket);

// Function to send RPC requests over WebSocket
async function sendRpcRequest(method, params = []) {
  if (!isConnected) {
    let connectionTimeout = false;
    
    // Set a 1-second timeout for connection attempts
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        connectionTimeout = true;
        reject(new Error('Connection timeout: Unable to connect to Celestia node. Please start your node with:\ncelestia light start --p2p.network mocha --core.ip rpc-mocha.pops.one --core.port 9090 --rpc.skip-auth'));
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

// Keep a reference to the axios client for any HTTP requests that might still be needed
const apiClient = axios.create({
  baseURL: CELESTIA_NODE_URL.replace('ws://', 'http://'),
  headers: {
    'Content-Type': 'application/json',
  }
});

// Random word lists for generating readable namespaces
const adjectives = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'gray',
  'tiny', 'small', 'big', 'huge', 'giant', 'fast', 'slow', 'bright', 'dark', 'shiny',
  'happy', 'sad', 'angry', 'calm', 'quiet', 'loud', 'brave', 'shy', 'clever', 'silly'
];

const nouns = [
  'cat', 'dog', 'bird', 'fish', 'tiger', 'lion', 'bear', 'wolf', 'fox', 'rabbit',
  'tree', 'flower', 'river', 'mountain', 'ocean', 'desert', 'forest', 'cloud', 'star', 'moon',
  'book', 'pen', 'phone', 'computer', 'house', 'car', 'bike', 'boat', 'plane', 'rocket'
];

// Reserved namespaces that should not be used
const RESERVED_NAMESPACES = {
  // Primary reserved namespaces (version 0)
  TRANSACTION_NAMESPACE: '0000000000000000000000000000000000000000000000000000000001',
  INTERMEDIATE_STATE_ROOT_NAMESPACE: '0000000000000000000000000000000000000000000000000000000002',
  PAY_FOR_BLOB_NAMESPACE: '0000000000000000000000000000000000000000000000000000000004',
  PRIMARY_RESERVED_PADDING_NAMESPACE: '00000000000000000000000000000000000000000000000000000000FF',
  
  // Secondary reserved namespaces (version 255)
  TAIL_PADDING_NAMESPACE: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE',
  PARITY_SHARE_NAMESPACE: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
};

// Function to get the node's account address
async function getNodeAddress() {
  try {
    const response = await sendRpcRequest('state.AccountAddress');
    
    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    return response.result;
  } catch (error) {
    console.error('Error getting node address:', error);
    return 'Unable to fetch address. Is your light node running at localhost:26658?';
  }
}

// Function to get the node's P2P info
async function getNodeP2PInfo() {
  try {
    const response = await sendRpcRequest('p2p.Info');
    
    if (response.error) {
      console.error('P2P Info API Error:', response.error);
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    if (!response.result) {
      console.error('No result in P2P Info response:', response);
      return null;
    }

    console.log('P2P Info response:', response.result);
    return response.result;
  } catch (error) {
    console.error('Error getting P2P info:', error);
    return null;
  }
}

// Function to get the node's account balance
async function getNodeBalance() {
  try {
    const response = await sendRpcRequest('state.Balance');
    
    if (response.error) {
      console.error('Balance API Error:', response.error);
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    if (!response.result) {
      console.error('No result in Balance response:', response);
      return 'Unable to fetch balance. Is your light node running at localhost:26658?';
    }

    console.log('Balance response:', response.result);
    
    // Format the balance for display
    const balance = response.result;
    if (typeof balance === 'object') {
      // If it's an object with denom and amount properties
      if (balance.denom && balance.amount !== undefined) {
        // Convert utia to TIA (1 TIA = 1,000,000 utia)
        if (balance.denom === 'utia') {
          const tiaAmount = parseFloat(balance.amount) / 1000000;
          return `${tiaAmount.toFixed(6)} TIA`;
        }
        return `${balance.amount} ${balance.denom}`;
      }
      // If it's a different object structure
      return JSON.stringify(balance);
    }
    
    return response.result;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 'Unable to fetch balance. Is your light node running at localhost:26658?';
  }
}

// Function to get DAS sampling stats
async function getSamplingStats() {
  try {
    const response = await sendRpcRequest('das.SamplingStats');
    
    if (response.error) {
      console.error('Sampling Stats API Error:', response.error);
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    if (!response.result) {
      console.error('No result in Sampling Stats response:', response);
      return null;
    }

    return response.result;
  } catch (error) {
    console.error('Error getting sampling stats:', error);
    return null;
  }
}

// Function to setup real-time sampling stats updates using EventSource
function setupRealtimeSamplingStats() {
  // Check if browser supports EventSource
  if (typeof EventSource === 'undefined') {
    console.warn('EventSource not supported in this browser. Falling back to polling.');
    return false;
  }
  
  // Create a controller that will allow us to abort the fetch request
  let controller = new AbortController();
  let signal = controller.signal;
  
  // Create variables to handle reconnection attempts
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout = null;
  
  // Find the live button
  const toggleStreamBtn = document.getElementById('toggleLiveButton');
  let isStreaming = true; // Start with streaming enabled
  
  if (toggleStreamBtn) {
    toggleStreamBtn.addEventListener('click', () => {
      if (isStreaming) {
        // Stop streaming
        stopStreaming();
        toggleStreamBtn.classList.remove('btn-success');
        toggleStreamBtn.classList.add('btn-outline-success');
        const indicatorDot = toggleStreamBtn.querySelector('.stream-indicator');
        if (indicatorDot) indicatorDot.classList.remove('streaming');
        const buttonText = toggleStreamBtn.querySelector('span:not(.stream-indicator)');
        if (buttonText) buttonText.textContent = 'PAUSED';
      } else {
        // Restart streaming with a new controller
        controller.abort(); // Make sure the old one is aborted
        controller = new AbortController();
        signal = controller.signal;
        startStreaming();
        toggleStreamBtn.classList.remove('btn-outline-success');
        toggleStreamBtn.classList.add('btn-success');
        const indicatorDot = toggleStreamBtn.querySelector('.stream-indicator');
        if (indicatorDot) indicatorDot.classList.add('streaming');
        const buttonText = toggleStreamBtn.querySelector('span:not(.stream-indicator)');
        if (buttonText) buttonText.textContent = 'LIVE';
      }
      isStreaming = !isStreaming;
    });
  }
  
  // Function to start streaming
  const startStreaming = () => {
    // Update Live button to show active streaming state
    if (toggleStreamBtn) {
      toggleStreamBtn.classList.remove('btn-outline-success');
      toggleStreamBtn.classList.add('btn-success');
      const indicatorDot = toggleStreamBtn.querySelector('.stream-indicator');
      if (indicatorDot) indicatorDot.classList.add('streaming');
      const buttonText = toggleStreamBtn.querySelector('span:not(.stream-indicator)');
      if (buttonText) buttonText.textContent = 'LIVE';
    }
    
    // Start fetching sampling stats in a loop to simulate streaming
    (async function streamStats() {
      if (signal.aborted) return;
      
      try {
        const stats = await getSamplingStats();
        if (stats) {
          updateSamplingStats(stats);
          reconnectAttempts = 0; // Reset reconnect attempts on success
          
          // Schedule the next update after a short delay (200ms for more real-time feel)
          setTimeout(streamStats, 200);
        } else {
          throw new Error('Failed to get sampling stats');
        }
      } catch (error) {
        console.error('Streaming error:', error);
        
        // Update Live button to show disconnected state
        if (toggleStreamBtn) {
          toggleStreamBtn.classList.remove('btn-success', 'btn-outline-success');
          toggleStreamBtn.classList.add('btn-outline-danger');
          const indicatorDot = toggleStreamBtn.querySelector('.stream-indicator');
          if (indicatorDot) {
            indicatorDot.classList.remove('streaming');
            indicatorDot.style.backgroundColor = '#dc3545';
          }
          const buttonText = toggleStreamBtn.querySelector('span:not(.stream-indicator)');
          if (buttonText) buttonText.textContent = 'ERROR';
        }
        
        // Try to reconnect if we haven't exceeded the maximum attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * reconnectAttempts, 5000); // Exponential backoff up to 5 seconds
          
          showToast(`Connection lost. Reconnecting in ${delay/1000}s...`);
          
          reconnectTimeout = setTimeout(() => {
            if (!signal.aborted) {
              streamStats();
            }
          }, delay);
        } else {
          showToast('Could not reconnect to the streaming service. Please refresh the page.');
        }
      }
    })();
    
    return true;
  };
  
  // Function to stop streaming
  const stopStreaming = () => {
    controller.abort();
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    // Update Live button to show paused state
    if (toggleStreamBtn) {
      toggleStreamBtn.classList.remove('btn-success', 'btn-outline-danger');
      toggleStreamBtn.classList.add('btn-outline-success');
      const indicatorDot = toggleStreamBtn.querySelector('.stream-indicator');
      if (indicatorDot) {
        indicatorDot.classList.remove('streaming');
        indicatorDot.style.backgroundColor = '';
      }
      const buttonText = toggleStreamBtn.querySelector('span:not(.stream-indicator)');
      if (buttonText) buttonText.textContent = 'PAUSED';
    }
  };
  
  // Start streaming immediately
  startStreaming();
  
  return true;
}

// Function to convert base64 to hex
function base64ToHex(base64) {
  try {
    const bytes = Buffer.from(base64, 'base64');
    
    // Special case: if the string is a valid namespace (29 bytes)
    if (bytes.length === 29) {
      // Extract only the ID part (last 10 bytes) in hex format
      return bytes.slice(19).toString('hex');
    }
    
    // For other base64 strings, convert the whole string to hex
    return bytes.toString('hex');
  } catch (error) {
    console.error('Error converting base64 to hex:', error);
    return '';
  }
}

// Function to convert hex to base64
function hexToBase64(hex) {
  try {
    const bytes = Buffer.from(hex, 'hex');
    return bytes.toString('base64');
  } catch (error) {
    console.error('Error converting hex to base64:', error);
    return '';
  }
}

// Function to create a valid Celestia namespace
function createValidNamespace(input) {
  // Create a namespace with version 0
  const version = 0;
  
  // For version 0, the ID must have 18 leading zero bytes followed by 10 user-specified bytes
  // Total namespace length is 29 bytes (1 byte version + 28 bytes ID)
  
  let id;
  if (typeof input === 'string') {
    // If input is a string, use it to generate the ID
    const hash = new Uint8Array(10);
    
    // Use the input string to influence the hash, padding from the right
    const inputBytes = new TextEncoder().encode(input);
    const startPos = Math.max(0, 10 - inputBytes.length);
    hash.set(inputBytes.slice(0, 10), startPos);
    
    // Create the ID with 18 leading zero bytes + 10 bytes from hash
    id = new Uint8Array(28);
    id.set(hash, 18);
  } else {
    // If no input, generate a completely random ID
    id = new Uint8Array(28);
    const randomPart = crypto.getRandomValues(new Uint8Array(10));
    id.set(randomPart, 18);
  }
  
  // Combine version and ID
  const namespace = new Uint8Array(29);
  namespace[0] = version;
  namespace.set(id, 1);
  
  // Convert to base64 for API use
  return Buffer.from(namespace).toString('base64');
}

// Function to check if a namespace is reserved
function isReservedNamespace(base64Namespace) {
  try {
    const bytes = Buffer.from(base64Namespace, 'base64');
    const hex = bytes.toString('hex');
    
    // Check if the namespace is in the reserved list
    return Object.values(RESERVED_NAMESPACES).some(reserved => hex.includes(reserved));
  } catch (error) {
    console.error('Error checking reserved namespace:', error);
    return false;
  }
}

// Function to validate a namespace according to Celestia specifications
function validateNamespace(base64Namespace) {
  try {
    // Decode from base64
    const bytes = Buffer.from(base64Namespace, 'base64');
    
    // Check length (must be 29 bytes: 1 byte version + 28 bytes ID)
    if (bytes.length !== 29) {
      return {
        valid: false,
        error: `Namespace must be exactly 29 bytes (got ${bytes.length})`
      };
    }
    
    // Get version (first byte)
    const version = bytes[0];
    
    // For version 0 (user-specifiable namespaces)
    if (version === 0) {
      // Check for 18 leading zero bytes in the ID
      for (let i = 0; i < 18; i++) {
        if (bytes[i + 1] !== 0) {
          return {
            valid: false,
            error: 'Version 0 namespace must have 18 leading zero bytes in the ID'
          };
        }
      }
    } else if (version !== 255) {
      // Only version 0 and 255 are currently supported
      return {
        valid: false,
        error: 'Only namespace versions 0 and 255 are supported'
      };
    }
    
    // Check if it's a reserved namespace
    if (isReservedNamespace(base64Namespace)) {
      return {
        valid: false,
        error: 'This is a reserved namespace and cannot be used for user data'
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid namespace format'
    };
  }
}

// Function to generate a random namespace
function generateRandomNamespace() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  
  const plaintext = `${adjective}-${noun}-${randomNum}`;
  const base64 = createValidNamespace(plaintext);
  const hex = base64ToHex(base64);
  
  return {
    plaintext,
    base64,
    hex
  };
}

// Function to submit a blob to the Celestia network
async function submitBlob(namespace, data, options = {}) {
  try {
    // Validate inputs
    if (!isValidBase64(namespace)) {
      throw new Error('Invalid namespace format. Must be base64 encoded.');
    }

    const namespaceValidation = validateNamespace(namespace);
    if (!namespaceValidation.valid) {
      throw new Error(`Invalid namespace: ${namespaceValidation.error}`);
    }

    if (!isValidBase64(data)) {
      throw new Error('Invalid data format. Must be base64 encoded.');
    }

    // Prepare the blob object
    const blob = {
      namespace: namespace,
      data: data,
      share_version: 0
    };

    // Send request via WebSocket
    const response = await sendRpcRequest('blob.Submit', [
      [blob], // Array of blobs
      options
    ]);

    // Check for errors in the response
    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }

    // Convert namespace to hex for display
    const namespaceHex = base64ToHex(namespace);

    // Return the height and namespace information
    return {
      height: response.result,
      namespaceHex: namespaceHex,
      namespaceBase64: namespace
    };
  } catch (error) {
    console.error('Error submitting blob:', error);
    throw error;
  }
}

// Function to retrieve a blob by height and namespace
async function retrieveBlob(height, namespaceHex) {
  try {
    // Check if connected to Celestia node
    if (!isConnected) {
      throw new Error('Connection timeout: Unable to connect to Celestia node. Please start your node with:\ncelestia light start --p2p.network mocha --core.ip rpc-mocha.pops.one --core.port 9090 --rpc.skip-auth');
    }
  
    // Validate the height
    const heightValue = parseInt(height, 10);
    if (isNaN(heightValue) || heightValue <= 0) {
      throw new Error('Invalid height. Must be a positive integer.');
    }
    
    // First we need to convert the hex namespace back to base64
    // The hex is just the last 10 bytes of the namespace ID, so we need to reconstruct the full namespace
    
    // For version 0 namespaces, we need to add a version byte (0) and 18 leading zero bytes
    const version = 0;
    const namespaceArray = new Uint8Array(29); // 29 bytes total
    namespaceArray[0] = version; // Set version byte
    
    // Convert hex to bytes
    const hexBytes = Buffer.from(namespaceHex, 'hex');
    
    // Place the hex bytes at the end (after the 18 zero bytes)
    // The offset is 1 (version byte) + 18 (leading zeros) = 19
    namespaceArray.set(hexBytes, 19);
    
    // Convert to base64 for the API
    const namespaceBase64 = Buffer.from(namespaceArray).toString('base64');
    
    // Simplified logging
    console.log(`Retrieving blob from height ${heightValue} with namespace ${namespaceBase64}`);
    
    // Use WebSocket to send the request
    const response = await sendRpcRequest('blob.GetAll', [heightValue, [namespaceBase64]]);
    
    if (response.error) {
      console.error('Blob retrieval error:', response.error);
      showToast(`Error: ${response.error.message}`);
      return null;
    }
    
    const result = response.result;
    
    if (!result) {
      console.error('No result in API response');
      return null;
    }
    
    console.log('Blob response:', result);
    
    // It might be that the blobs are not in a 'blobs' property
    // Try to adapt to whatever structure we received
    let blobs = [];
    if (Array.isArray(result)) {
      blobs = result;
    } else if (result.blobs && Array.isArray(result.blobs)) {
      blobs = result.blobs;
    } else if (typeof result === 'object') {
      for (const key in result) {
        if (Array.isArray(result[key])) {
          blobs = result[key];
          break;
        }
      }
    }
    
    if (blobs && blobs.length > 0) {
      console.log(`Found ${blobs.length} blob(s)`);
      return blobs[0]; // Return the first blob directly instead of wrapping in object
    } else {
      console.error('No blobs found in response');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving blob:', error.message);
    showToast(`Error: ${error.message}`);
    return null;
  }
}

// Helper function to validate base64 string
function isValidBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

// DOM Elements
const blobForm = document.getElementById('blobForm');
const namespaceTypeRadios = document.querySelectorAll('input[name="namespaceType"]');
const base64NamespaceInput = document.getElementById('base64NamespaceInput');
const plaintextNamespaceInputContainer = document.getElementById('plaintextNamespaceInput');
const randomNamespaceInputContainer = document.getElementById('randomNamespaceInput');
const namespaceInput = document.getElementById('namespace');
const plaintextNamespaceInput = document.getElementById('plaintextNamespace');
const randomNamespaceInput = document.getElementById('randomNamespace');
const generateNamespaceBtn = document.getElementById('generateNamespaceBtn');
const dataInput = document.getElementById('data');
const gasPriceInput = document.getElementById('gasPrice');
const loadingElement = document.getElementById('loading');
const errorMessageElement = document.getElementById('errorMessage');
const resultContainer = document.getElementById('resultContainer');
const resultHeightElement = document.getElementById('resultHeight');
const resultNamespaceHexElement = document.getElementById('resultNamespaceHex');
const resultNamespaceBase64Element = document.getElementById('resultNamespaceBase64');
const nodeAddressElement = document.getElementById('nodeAddress');
const nodeP2PInfoElement = document.getElementById('nodeP2PInfo');

// Namespace hex display elements
const base64NamespacePreview = document.getElementById('base64NamespacePreview');
const plaintextNamespacePreview = document.getElementById('plaintextNamespacePreview');
const randomNamespacePreview = document.getElementById('randomNamespacePreview');
const base64NamespaceHex = document.getElementById('base64NamespaceHex');
const plaintextNamespaceHex = document.getElementById('plaintextNamespaceHex');
const randomNamespaceHex = document.getElementById('randomNamespaceHex');

// Base64 encoding tools
const rawTextInput = document.getElementById('rawText');
const encodedTextOutput = document.getElementById('encodedText');

// Function to safely encode text to base64
function encodeToBase64(text) {
  try {
    return btoa(text);
  } catch (error) {
    console.error('Error encoding text:', error);
    return '';
  }
}

// Function to safely decode base64 to text
function decodeFromBase64(base64) {
  try {
    return atob(base64);
  } catch (error) {
    console.error('Error decoding base64:', error);
    return '';
  }
}

// Event listeners for automatic conversion
let isUpdating = false;

rawTextInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;
  
  const rawText = rawTextInput.value;
  if (rawText) {
    encodedTextOutput.value = encodeToBase64(rawText);
  } else {
    encodedTextOutput.value = '';
  }
  
  isUpdating = false;
});

encodedTextOutput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;
  
  const base64 = encodedTextOutput.value;
  if (base64) {
    rawTextInput.value = decodeFromBase64(base64);
  } else {
    rawTextInput.value = '';
  }
  
  isUpdating = false;
});

// Add click-to-copy functionality to both textareas
rawTextInput.addEventListener('click', () => {
  if (rawTextInput.value) {
    copyToClipboard(rawTextInput.value);
  }
});

encodedTextOutput.addEventListener('click', () => {
  if (encodedTextOutput.value) {
    copyToClipboard(encodedTextOutput.value);
  }
});

// Fetch and display node information on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Generate a random namespace
  const randomNamespace = generateRandomNamespace();
  randomNamespaceInput.value = randomNamespace.base64;
  randomNamespaceInput.setAttribute('data-plaintext', randomNamespace.plaintext);
  randomNamespaceInput.setAttribute('data-hex', randomNamespace.hex);
  
  // Display the hex value for the random namespace
  if (randomNamespaceHex) {
    randomNamespaceHex.textContent = randomNamespace.hex;
  }
  
  // Fetch and display node address
  const address = await getNodeAddress();
  if (nodeAddressElement) {
    nodeAddressElement.textContent = address;
  }
  
  // Fetch and display P2P info
  const p2pInfo = await getNodeP2PInfo();
  if (nodeP2PInfoElement) {
    if (p2pInfo && p2pInfo.ID) {
      nodeP2PInfoElement.textContent = p2pInfo.ID;
    } else {
      nodeP2PInfoElement.textContent = 'Unable to fetch p2p info. Is your light node running at localhost:26658?';
      console.error('Failed to get P2P info:', p2pInfo);
    }
  }
  
  // Fetch and display node balance
  await refreshNodeBalance();
  
  // Set up periodic balance refresh (every 5 seconds for quicker update)
  const nodeBalanceElement = document.getElementById('nodeBalance');
  setInterval(async () => {
    try {
      // First check if we're connected before trying to get the balance
      if (!isConnected) {
        // If we're already disconnected, make sure UI reflects this state
        if (nodeBalanceElement) {
          nodeBalanceElement.textContent = 'Unable to fetch balance. Is your node running?';
          nodeBalanceElement.classList.add('text-danger');
        }
        await updateAllNodeInfo();
        return;
      }
      
      const updatedBalance = await getNodeBalance();
      if (nodeBalanceElement) {
        if (updatedBalance && !updatedBalance.includes('Unable to fetch')) {
          // Only update if the value changed
          if (nodeBalanceElement.textContent !== updatedBalance) {
            // Remove text-danger if it was previously showing an error
            nodeBalanceElement.classList.remove('text-danger');
            
            nodeBalanceElement.textContent = updatedBalance;
            nodeBalanceElement.classList.remove('value-changed');
            // Force reflow to restart animation
            void nodeBalanceElement.offsetWidth;
            nodeBalanceElement.classList.add('value-changed');
          }
        } else {
          // If balance check fails, update all node info
          nodeBalanceElement.textContent = 'Unable to fetch balance. Is your node running?';
          nodeBalanceElement.classList.add('text-danger');
          await updateAllNodeInfo();
        }
      }
    } catch (error) {
      console.error('Error in balance refresh interval:', error);
      if (nodeBalanceElement) {
        nodeBalanceElement.textContent = 'Unable to fetch balance. Is your node running?';
        nodeBalanceElement.classList.add('text-danger');
        await updateAllNodeInfo();
      }
    }
  }, 5000); // Changed from 30000 to 5000 for faster detection of node shutdown
  
  // Fetch and display sampling stats
  const samplingStats = await getSamplingStats();
  if (samplingStats) {
    updateSamplingStats(samplingStats);
    
    // Initialize real-time streaming for sampling stats
    const isStreamingSupported = setupRealtimeSamplingStats();
    
    // Fall back to polling if streaming is not supported
    if (!isStreamingSupported) {
      console.log('Falling back to polling for sampling stats');
      // Set up a refresh interval for sampling stats (every 5 seconds)
      setInterval(async () => {
        const updatedStats = await getSamplingStats();
        if (updatedStats) {
          updateSamplingStats(updatedStats);
        }
      }, 5000);
    }
    
    // Add event listener for manual refresh button
    const refreshButton = document.getElementById('refreshSamplingStats');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        // Show refresh animation on button
        refreshButton.classList.add('rotating');
        
        // Fetch and update stats
        const updatedStats = await getSamplingStats();
        if (updatedStats) {
          updateSamplingStats(updatedStats);
          showToast('Sampling stats refreshed');
        } else {
          showToast('Failed to refresh sampling stats');
        }
        
        // Remove rotation animation
        setTimeout(() => {
          refreshButton.classList.remove('rotating');
        }, 500);
      });
    }
  } else {
    document.getElementById('samplingStats').textContent = 'Unable to fetch sampling stats. Is your light node running at localhost:26658?';
  }
  
  // Setup transfer form
  const transferForm = document.getElementById('transferForm');
  const transferLoading = document.getElementById('transferLoading');
  const transferError = document.getElementById('transferError');
  const transferSuccess = document.getElementById('transferSuccess');
  
  if (transferForm) {
    transferForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const recipientAddress = document.getElementById('recipientAddress').value.trim();
      const transferAmount = document.getElementById('transferAmount').value;
      const gasAdjustment = parseFloat(document.getElementById('gasAdjustment').value) || 1.3;
      
      if (!recipientAddress) {
        transferError.textContent = 'Please enter a valid recipient address';
        transferError.style.display = 'block';
        transferSuccess.style.display = 'none';
        return;
      }
      
      if (!transferAmount || isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
        transferError.textContent = 'Please enter a valid amount greater than 0';
        transferError.style.display = 'block';
        transferSuccess.style.display = 'none';
        return;
      }
      
      try {
        transferError.style.display = 'none';
        transferSuccess.style.display = 'none';
        transferLoading.style.display = 'block';
        
        const txResult = await transferTIA(recipientAddress, transferAmount, gasAdjustment);
        
        // Show success message with transaction details
        if (txResult && txResult.txhash) {
          const transferTxHash = document.getElementById('transferTxHash');
          const transferExplorerLink = document.getElementById('transferExplorerLink');
          
          if (transferTxHash) {
            transferTxHash.textContent = txResult.txhash;
          }
          
          if (transferExplorerLink) {
            const explorerUrl = `https://mocha.celenium.io/tx/${txResult.txhash}`;
            transferExplorerLink.href = explorerUrl;
          }
        }
        
        transferSuccess.style.display = 'block';
        
        // Reset form
        transferForm.reset();
        
        // Set default gas adjustment value after reset
        document.getElementById('gasAdjustment').value = "1.3";
        
        // Refresh node balance after successful transfer
        await refreshNodeBalance();
        
        // Show toast notification
        showToast('Transfer completed successfully!');
      } catch (error) {
        // Show error message
        transferError.textContent = `Transfer failed: ${error.message || 'Unknown error'}`;
        transferError.style.display = 'block';
      } finally {
        transferLoading.style.display = 'none';
      }
    });
  }
  
  // Setup tab navigation
  setupTabNavigation();
  
  // Handle tab click for database tab
  const databaseTab = document.getElementById('database-tab');
  if (databaseTab) {
    databaseTab.addEventListener('shown.bs.tab', () => {
      // Refresh database info when tab is shown
      updateDatabaseInfoPanel();
      displayDatabaseRecords();
      displayDatabaseSchema();
    });
  }
  
  // Setup database clear cache functionality
  const clearDbCacheBtn = document.getElementById('clearDbCacheBtn');
  if (clearDbCacheBtn) {
    clearDbCacheBtn.addEventListener('click', () => {
      // Ask for confirmation before clearing cache
      if (confirm('Are you sure you want to clear the database cache? This will remove all local database information and your encryption token, effectively making any future data inaccessible with a different key.')) {
        clearDatabaseCache();
        showToast('Database cache and encryption token cleared. Any future database will use a new encryption key.', 'success');
      }
    });
  }
  
  // Setup database namespace generator
  const generateDbNamespaceBtn = document.getElementById('generateDbNamespaceBtn');
  if (generateDbNamespaceBtn) {
    generateDbNamespaceBtn.addEventListener('click', () => {
      const randomNamespace = generateRandomNamespace();
      const dbNamespaceInput = document.getElementById('dbNamespace');
      const dbNamespaceHex = document.getElementById('dbNamespaceHex');
      
      if (dbNamespaceInput) {
        dbNamespaceInput.value = randomNamespace.base64;
      }
      
      if (dbNamespaceHex) {
        dbNamespaceHex.textContent = randomNamespace.hex;
      }
    });
  }
  
  // Setup database initialization form
  const initDbForm = document.getElementById('initDbForm');
  if (initDbForm) {
    initDbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const namespace = document.getElementById('dbNamespace').value;
      const schema = document.getElementById('dbSchema').value;
      
      // Check if a database is already initialized
      const existingNamespace = localStorage.getItem(DB_NAMESPACE_KEY);
      const existingSchemaHeight = localStorage.getItem(DB_SCHEMA_HEIGHT_KEY);
      
      // If a database is already initialized, show a confirmation dialog
      if (existingNamespace && existingSchemaHeight) {
        if (!confirm('You already have an initialized database. Initializing a new one will overwrite your local database information and use a new encryption key. This means you will no longer be able to access your existing database with this browser. Are you sure you want to continue?')) {
          return; // User canceled, don't proceed
        }
      }
      
      // Show loading
      document.getElementById('initDbLoading').style.display = 'block';
      document.getElementById('initDbSuccess').style.display = 'none';
      document.getElementById('initDbError').style.display = 'none';
      
      try {
        const result = await initializeDatabase(namespace, schema);
        
        // Show success
        document.getElementById('initDbSuccess').style.display = 'block';
        document.getElementById('initDbNamespace').textContent = namespace;
        document.getElementById('initDbHeight').textContent = result.schemaHeight;
        
        // Update the namespace explorer link
        const namespaceHex = base64ToHex(namespace);
        const initDbNamespaceLink = document.getElementById('initDbNamespaceLink');
        if (initDbNamespaceLink) {
          initDbNamespaceLink.href = `https://mocha.celenium.io/namespace/000000000000000000000000000000000000${namespaceHex}?tab=Blobs`;
        }
        
        // Update the database info panel
        updateDatabaseInfoPanel();
        
        // Display the schema
        displayDatabaseSchema();
        
        // Clear form
        document.getElementById('dbSchema').value = '';
      } catch (error) {
        // Show error
        document.getElementById('initDbError').style.display = 'block';
        document.getElementById('initDbError').textContent = `Error: ${error.message}`;
      } finally {
        document.getElementById('initDbLoading').style.display = 'none';
      }
    });
  }
  
  // Setup add record form
  const addRecordForm = document.getElementById('addRecordForm');
  if (addRecordForm) {
    addRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = document.getElementById('recordData').value;
      
      // Show loading
      document.getElementById('addRecordLoading').style.display = 'block';
      document.getElementById('addRecordError').style.display = 'none';
      
      try {
        await addDatabaseRecord(data);
        
        // Update the database info panel and records table
        updateDatabaseInfoPanel();
        await displayDatabaseRecords();
        
        // Clear form
        document.getElementById('recordData').value = '';
        
        // Show toast
        showToast('Record added successfully!');
      } catch (error) {
        // Show error
        document.getElementById('addRecordError').style.display = 'block';
        document.getElementById('addRecordError').textContent = `Error: ${error.message}`;
      } finally {
        document.getElementById('addRecordLoading').style.display = 'none';
      }
    });
  }
  
  // Refresh button
  const refreshDbBtn = document.getElementById('refreshDbBtn');
  if (refreshDbBtn) {
    refreshDbBtn.addEventListener('click', async () => {
      updateDatabaseInfoPanel();
      await displayDatabaseRecords();
      
      // Add rotation animation to button
      refreshDbBtn.classList.add('rotating');
      setTimeout(() => {
        refreshDbBtn.classList.remove('rotating');
      }, 500);
      
      showToast('Database refreshed!');
    });
  }
  
  // Initialize the database UI on page load
  updateDatabaseInfoPanel();
});

// Function to set up tab navigation
function setupTabNavigation() {
  // Get all tab buttons and content
  const tabButtons = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-pane');
  
  // Add click event listener to each tab button
  tabButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      // Prevent default anchor click behavior
      event.preventDefault();
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      
      tabContents.forEach(content => {
        content.classList.remove('show', 'active');
      });
      
      // Add active class to the clicked button
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      
      // Get the target content from data-bs-target attribute and show it
      const target = button.getAttribute('data-bs-target');
      const targetContent = document.querySelector(target);
      if (targetContent) {
        targetContent.classList.add('show', 'active');
      }
    });
  });
  
  // Check if there's a hash in the URL to determine which tab to show
  if (window.location.hash) {
    const hash = window.location.hash;
    const tabToShow = document.querySelector(`[data-bs-target="${hash}"]`);
    if (tabToShow) {
      tabToShow.click();
    }
  }
}

// Function to update the sampling stats in the UI
function updateSamplingStats(stats) {
  // Helper function to update a value with animation if it changed
  const updateValueWithAnimation = (elementId, newValue) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = element.textContent;
    if (currentValue !== String(newValue)) {
      // Value changed, add animation
      element.textContent = newValue;
      element.classList.remove('value-changed');
      // Force reflow to restart animation
      void element.offsetWidth;
      element.classList.add('value-changed');
    }
  };
  
  // Update the main stats elements with animation
  updateValueWithAnimation('headOfSampledChain', stats.head_of_sampled_chain);
  updateValueWithAnimation('headOfCatchup', stats.head_of_catchup);
  updateValueWithAnimation('networkHeadHeight', stats.network_head_height);
  
  // Update the last updated timestamp
  const now = new Date();
  const timeString = now.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('lastUpdatedTime').textContent = timeString;
  
  // Update catch-up status
  const catchupStatus = document.getElementById('catchupStatus');
  const prevStatus = catchupStatus.textContent;
  let newStatus;
  
  if (stats.catch_up_done) {
    newStatus = 'Complete';
    catchupStatus.style.color = '#28a745'; // Green for completed
  } else if (stats.is_running) {
    newStatus = 'In Progress';
    catchupStatus.style.color = '#007bff'; // Blue for in progress
  } else {
    newStatus = 'Not Running';
    catchupStatus.style.color = '#dc3545'; // Red for not running
  }
  
  if (prevStatus !== newStatus) {
    catchupStatus.textContent = newStatus;
    catchupStatus.classList.remove('value-changed');
    void catchupStatus.offsetWidth;
    catchupStatus.classList.add('value-changed');
  }
  
  // Calculate sync progress percentage
  const progressBar = document.getElementById('syncProgressBar');
  const behindBlocks = stats.network_head_height - stats.head_of_sampled_chain;
  const totalBlocks = stats.network_head_height;
  let progressPercent = 0;
  
  if (totalBlocks > 0) {
    progressPercent = Math.min(100, Math.max(0, ((totalBlocks - behindBlocks) / totalBlocks) * 100));
    progressPercent = Math.round(progressPercent * 10) / 10; // Round to 1 decimal place
  }
  
  // Get the current progress
  const currentProgress = parseFloat(progressBar.getAttribute('aria-valuenow') || '0');
  
  // Update the progress bar only if the value changed significantly (more than 0.1%)
  if (Math.abs(progressPercent - currentProgress) > 0.1) {
    // Ensure we show at least a tiny bit of the progress bar even at 0%
    const displayWidth = progressPercent === 0 ? '0.5%' : `${progressPercent}%`;
    progressBar.style.width = displayWidth;
    progressBar.setAttribute('aria-valuenow', progressPercent);
    
    // Only add percentage text for wider progress bars
    progressBar.innerHTML = progressPercent > 10 ? `<span class="ms-auto d-flex align-items-center h-100">${progressPercent}%</span>` : '';
    
    // Set progress bar color based on completion percentage
    if (progressPercent >= 90) {
      progressBar.classList.remove('bg-warning', 'bg-danger');
      progressBar.classList.add('bg-success');
    } else if (progressPercent >= 50) {
      progressBar.classList.remove('bg-success', 'bg-danger');
      progressBar.classList.add('bg-warning');
    } else {
      progressBar.classList.remove('bg-success', 'bg-warning');
      progressBar.classList.add('bg-danger');
    }
    
    // Adjust the percentage text color based on the progress bar color
    const percentText = progressBar.querySelector('span');
    if (percentText) {
      if (progressBar.classList.contains('bg-warning')) {
        percentText.style.color = '#333';
      } else {
        percentText.style.color = '#fff';
      }
    }
  }
  
  // Update workers count
  updateValueWithAnimation('workersCount', stats.concurrency);
  
  // Update workers details
  const workersDetails = document.getElementById('workersDetails');
  
  // Get existing worker rows if available
  const existingTable = workersDetails.querySelector('table');
  const existingTbody = existingTable ? existingTable.querySelector('tbody') : null;
  
  if (stats.workers && stats.workers.length > 0) {
    // Remove the no-active-workers class if it exists
    workersDetails.classList.remove('no-active-workers');
    
    // Create or reuse the table
    let table, tbody;
    
    if (existingTable) {
      // Reuse the existing table
      table = existingTable;
      tbody = existingTbody;
      // Clear only the tbody for reuse
      tbody.innerHTML = '';
    } else {
      // Create a new table
      workersDetails.innerHTML = ''; // Clear previous content
      table = document.createElement('table');
      table.className = 'table table-sm table-striped';
      
      // Create table header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Job Type</th>
          <th>Current</th>
          <th>From</th>
          <th>To</th>
          <th>Progress</th>
        </tr>
      `;
      table.appendChild(thead);
      
      // Create table body
      tbody = document.createElement('tbody');
      table.appendChild(tbody);
      workersDetails.appendChild(table);
    }
    
    // Create worker status tracking object if it doesn't exist
    if (!window.workerStatus) {
      window.workerStatus = {};
    }
    
    // Add/update rows for each worker
    stats.workers.forEach(worker => {
      // Create a unique ID for this worker
      const workerId = `${worker.job_type}-${worker.from}-${worker.to}`;
      
      // Calculate worker progress
      const workerTotal = worker.to - worker.from + 1;
      const workerProgress = worker.current - worker.from + 1;
      const workerPercent = workerTotal > 0 ? Math.min(100, Math.round((workerProgress / workerTotal) * 100)) : 0;
      
      // Check if this is a new value
      const isNewValue = !window.workerStatus[workerId] || 
                          window.workerStatus[workerId].current !== worker.current ||
                          window.workerStatus[workerId].percent !== workerPercent;
      
      // Update the tracking object
      window.workerStatus[workerId] = {
        current: worker.current,
        percent: workerPercent
      };
      
      const row = document.createElement('tr');
      
      // Add animation class if this is a value change
      if (isNewValue) {
        row.classList.add('value-changed');
      }
      
      row.innerHTML = `
        <td>${worker.job_type}</td>
        <td>${worker.current}</td>
        <td>${worker.from}</td>
        <td>${worker.to}</td>
        <td>
          <div class="progress" style="height: 10px;">
            <div class="progress-bar" role="progressbar" style="width: ${workerPercent}%" 
                 aria-valuenow="${workerPercent}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <span class="small">${workerPercent}%</span>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    // Clean up any workers that no longer exist
    const currentWorkerIds = stats.workers.map(w => `${w.job_type}-${w.from}-${w.to}`);
    for (const id in window.workerStatus) {
      if (!currentWorkerIds.includes(id)) {
        delete window.workerStatus[id];
      }
    }
  } else {
    workersDetails.textContent = 'No active workers';
    workersDetails.classList.add('no-active-workers');
  }
  
  // Update overall status
  const samplingStats = document.getElementById('samplingStats');
  const prevSyncStatus = samplingStats.textContent;
  let newSyncStatus;
  
  if (behindBlocks <= 100) {
    newSyncStatus = `Synced (${behindBlocks} blocks behind head)`;
  } else {
    newSyncStatus = `Syncing... (${behindBlocks} blocks behind head)`;
  }
  
  if (prevSyncStatus !== newSyncStatus) {
    samplingStats.textContent = newSyncStatus;
    samplingStats.classList.remove('value-changed');
    void samplingStats.offsetWidth;
    samplingStats.classList.add('value-changed');
  }
}

// Event listener for base64 namespace input to show hex preview
namespaceInput.addEventListener('input', () => {
  const base64 = namespaceInput.value.trim();
  if (base64 && isValidBase64(base64)) {
    const hex = base64ToHex(base64);
    if (base64NamespaceHex) {
      base64NamespaceHex.textContent = hex;
      base64NamespacePreview.classList.add('active');
    }
  } else {
    base64NamespacePreview.classList.remove('active');
  }
});

// Event listener for plaintext namespace input to show hex preview
plaintextNamespaceInput.addEventListener('input', () => {
  const plaintext = plaintextNamespaceInput.value.trim();
  if (plaintext) {
    // Check if input is too long (more than 10 bytes)
    const inputBytes = new TextEncoder().encode(plaintext);
    if (inputBytes.length > 10) {
      showToast('Plaintext namespace must be 10 bytes or less');
      plaintextNamespacePreview.classList.remove('active');
      return;
    }
    
    const base64 = createValidNamespace(plaintext);
    const hex = base64ToHex(base64);
    if (plaintextNamespaceHex) {
      plaintextNamespaceHex.textContent = hex;
      plaintextNamespacePreview.classList.add('active');
    }
  } else {
    plaintextNamespacePreview.classList.remove('active');
  }
});

// Event listeners for namespace type selection
namespaceTypeRadios.forEach(radio => {
  radio.addEventListener('change', (event) => {
    // Hide all namespace input groups
    base64NamespaceInput.classList.remove('active');
    plaintextNamespaceInputContainer.classList.remove('active');
    randomNamespaceInputContainer.classList.remove('active');
    
    // Show the selected input group
    const selectedType = event.target.value;
    if (selectedType === 'base64') {
      base64NamespaceInput.classList.add('active');
      // Update hex preview if there's a value
      const base64 = namespaceInput.value.trim();
      if (base64 && isValidBase64(base64)) {
        const hex = base64ToHex(base64);
        if (base64NamespaceHex) {
          base64NamespaceHex.textContent = hex;
          base64NamespacePreview.classList.add('active');
        }
      }
    } else if (selectedType === 'plaintext') {
      plaintextNamespaceInputContainer.classList.add('active');
      // Update hex preview if there's a value
      const plaintext = plaintextNamespaceInput.value.trim();
      if (plaintext) {
        const base64 = createValidNamespace(plaintext);
        const hex = base64ToHex(base64);
        if (plaintextNamespaceHex) {
          plaintextNamespaceHex.textContent = hex;
          plaintextNamespacePreview.classList.add('active');
        }
      }
    } else if (selectedType === 'random') {
      randomNamespaceInputContainer.classList.add('active');
      // Generate a random namespace if none exists
      if (!randomNamespaceInput.value) {
        const randomNamespace = generateRandomNamespace();
        randomNamespaceInput.value = randomNamespace.base64;
        randomNamespaceInput.setAttribute('data-plaintext', randomNamespace.plaintext);
        randomNamespaceInput.setAttribute('data-hex', randomNamespace.hex);
        if (randomNamespaceHex) {
          randomNamespaceHex.textContent = randomNamespace.hex;
        }
      } else if (randomNamespaceHex) {
        // Display the existing hex value
        randomNamespaceHex.textContent = randomNamespaceInput.getAttribute('data-hex') || '';
      }
    }
  });
});

// Event listener for generate namespace button
generateNamespaceBtn.addEventListener('click', () => {
  const randomNamespace = generateRandomNamespace();
  randomNamespaceInput.value = randomNamespace.base64;
  randomNamespaceInput.setAttribute('data-plaintext', randomNamespace.plaintext);
  randomNamespaceInput.setAttribute('data-hex', randomNamespace.hex);
  if (randomNamespaceHex) {
    randomNamespaceHex.textContent = randomNamespace.hex;
  }
});

// Event listener for form submission
blobForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  // Hide previous results and errors
  resultContainer.style.display = 'none';
  errorMessageElement.style.display = 'none';
  errorMessageElement.textContent = '';
  
  // Show loading indicator
  loadingElement.style.display = 'block';
  
  try {
    // Get the selected namespace type
    const selectedType = document.querySelector('input[name="namespaceType"]:checked').value;
    
    // Get the namespace based on the selected type
    let namespace;
    if (selectedType === 'base64') {
      namespace = namespaceInput.value.trim();
      
      // Validate the namespace
      const validation = validateNamespace(namespace);
      if (!validation.valid) {
        throw new Error(`Invalid namespace: ${validation.error}`);
      }
    } else if (selectedType === 'plaintext') {
      const plaintext = plaintextNamespaceInput.value.trim();
      if (!plaintext) {
        throw new Error('Plaintext namespace is required');
      }
      
      // Check if plaintext is too long
      const inputBytes = new TextEncoder().encode(plaintext);
      if (inputBytes.length > 10) {
        throw new Error('Plaintext namespace must be 10 bytes or less');
      }
      
      namespace = createValidNamespace(plaintext);
    } else if (selectedType === 'random') {
      namespace = randomNamespaceInput.value.trim();
    }
    
    // Validate namespace
    if (!namespace) {
      throw new Error('Namespace is required');
    }
    
    // Get other form values
    const data = dataInput.value.trim();
    const gasPrice = gasPriceInput.value ? parseFloat(gasPriceInput.value) : 0.002;
    
    // Prepare options
    const options = {
      gas_price: gasPrice,
      is_gas_price_set: true
    };
    
    // Submit the blob
    const result = await submitBlob(namespace, data, options);
    
    // Show success result
    updateResultContainer(result);
    
  } catch (error) {
    // Display error message
    errorMessageElement.textContent = error.message || 'An error occurred while submitting the blob.';
    errorMessageElement.style.display = 'block';
  } finally {
    // Hide loading indicator
    loadingElement.style.display = 'none';
  }
});

// Update the result container with successful submission details
function updateResultContainer(result) {
  resultHeightElement.textContent = result.height;
  resultNamespaceHexElement.textContent = result.namespaceHex;
  resultNamespaceBase64Element.textContent = result.namespaceBase64;
  
  // Update the namespace explorer link
  const namespaceLink = document.getElementById('resultNamespaceLink');
  if (namespaceLink) {
    namespaceLink.href = `https://mocha.celenium.io/namespace/000000000000000000000000000000000000${result.namespaceHex}?tab=Blobs`;
  }
  
  // Set values for retrieval form
  if (document.getElementById('retrieveHeight')) {
    document.getElementById('retrieveHeight').value = result.height;
  }
  if (document.getElementById('retrieveNamespace')) {
    document.getElementById('retrieveNamespace').value = result.namespaceHex;
  }
  
  // Update the command display
  if (document.getElementById('commandHeight')) {
    document.getElementById('commandHeight').textContent = result.height;
  }
  if (document.getElementById('commandNamespace')) {
    document.getElementById('commandNamespace').textContent = result.namespaceHex;
  }
  
  // Refresh the node balance after submission with a 3-second delay
  setTimeout(() => {
    refreshNodeBalance();
  }, 5000);
  
  resultContainer.style.display = 'block';
}

// Event listener for blob retrieval
if (document.getElementById('retrieveForm')) {
  document.getElementById('retrieveForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const height = document.getElementById('retrieveHeight').value.trim();
    const namespaceHex = document.getElementById('retrieveNamespace').value.trim();
    
    if (!height || !namespaceHex) {
      showToast('Please enter both height and namespace');
      return;
    }
    
    // Clear previous results
    const blobResultsContainer = document.getElementById('blobResults');
    if (blobResultsContainer) {
      blobResultsContainer.style.display = 'none';
    }
    
    // Show loading
    showToast('Retrieving blob data...');
    
    try {
      // Fetch the blob
      const result = await retrieveBlob(height, namespaceHex);
      
      // Display results
      if (result) {
        // Update UI with blob data
        if (document.getElementById('fetchedCommitment')) {
          document.getElementById('fetchedCommitment').textContent = result.commitment || 'N/A';
        }
        if (document.getElementById('fetchedNamespace')) {
          document.getElementById('fetchedNamespace').textContent = result.namespace || 'N/A';
        }
        if (document.getElementById('fetchedData')) {
          // Display raw data in the code block without any conversion
          document.getElementById('fetchedData').textContent = result.data || 'N/A';
        }
        
        // Update the namespace explorer link
        const fetchedNamespaceLink = document.getElementById('fetchedNamespaceLink');
        if (fetchedNamespaceLink) {
          fetchedNamespaceLink.href = `https://mocha.celenium.io/namespace/000000000000000000000000000000000000${namespaceHex}?tab=Blobs`;
        }
        
        // Update command line examples
        updateCommandExamples(height, namespaceHex, result.commitment);
        
        if (blobResultsContainer) {
          blobResultsContainer.style.display = 'block';
        }
        
        showToast('Blob retrieved successfully');
      } else {
        showToast('No blob found');
      }
    } catch (error) {
      console.error('Error in blob retrieval:', error.message);
      showToast(`Error: ${error.message}`);
    }
  });
}

// Function to update command examples with the correct values
function updateCommandExamples(height, namespaceHex, commitment) {
  // Generate the base64 namespace for the API
  const version = 0;
  const namespaceArray = new Uint8Array(29);
  namespaceArray[0] = version;
  
  try {
    const hexBytes = Buffer.from(namespaceHex, 'hex');
    namespaceArray.set(hexBytes, 19);
    
    const namespaceBase64 = Buffer.from(namespaceArray).toString('base64');
    
    // For CLI command (uses hex for both namespace and commitment)
    if (document.getElementById('cliHeight')) {
      document.getElementById('cliHeight').textContent = height;
    }
    if (document.getElementById('cliNamespace')) {
      document.getElementById('cliNamespace').textContent = namespaceHex;
    }
    if (document.getElementById('cliCommitment')) {
      // Convert the base64 commitment to hex for CLI
      const commitmentHex = commitment ? Buffer.from(commitment, 'base64').toString('hex') : '';
      document.getElementById('cliCommitment').textContent = commitmentHex;
    }
    
    // For curl command (uses base64 namespace and commitment)
    if (document.getElementById('curlHeight')) {
      document.getElementById('curlHeight').textContent = height;
    }
    if (document.getElementById('curlNamespace')) {
      document.getElementById('curlNamespace').textContent = namespaceBase64;
    }
    if (document.getElementById('curlCommitment')) {
      document.getElementById('curlCommitment').textContent = commitment || '';
    }
  } catch (error) {
    console.error('Error updating command examples:', error.message);
  }
}

// Add copy functionality for CLI command
if (document.getElementById('copyCLICommand')) {
  document.getElementById('copyCLICommand').addEventListener('click', () => {
    const command = document.getElementById('cliCommand').textContent;
    copyToClipboard(command);
  });
}

// Add copy functionality for curl command
if (document.getElementById('copyCurlCommand')) {
  document.getElementById('copyCurlCommand').addEventListener('click', () => {
    const command = document.getElementById('curlCommand').textContent;
    copyToClipboard(command);
  });
}

// Helper function to show toast notification
function showToast(message) {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  // Trigger reflow to enable transition
  toast.offsetHeight;
  toast.classList.add('show');
  
  // Remove toast after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, 2000);
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  }).catch(err => {
    console.error('Could not copy text: ', err);
    showToast('Failed to copy text');
  });
}

// Function to refresh node balance
async function refreshNodeBalance() {
  try {
    const balance = await getNodeBalance();
    const nodeBalanceElement = document.getElementById('nodeBalance');
    
    if (nodeBalanceElement) {
      // Consider any balance result containing "Unable to fetch" as an error
      if (balance && !balance.includes('Unable to fetch')) {
        nodeBalanceElement.textContent = balance;
        nodeBalanceElement.classList.remove('text-danger');
        nodeBalanceElement.classList.add('value-changed');
        // Animation will be removed after a delay
        setTimeout(() => {
          nodeBalanceElement.classList.remove('value-changed');
        }, 1500);
      } else {
        // If balance check fails, display error and update all node info
        nodeBalanceElement.textContent = 'Unable to fetch balance. Is your node running?';
        nodeBalanceElement.classList.add('text-danger');
        
        // Since balance check failed, check all other node info as well
        await updateAllNodeInfo();
      }
    }
  } catch (error) {
    console.error('Error refreshing balance:', error);
    const nodeBalanceElement = document.getElementById('nodeBalance');
    if (nodeBalanceElement) {
      nodeBalanceElement.textContent = 'Unable to fetch balance. Is your node running?';
      nodeBalanceElement.classList.add('text-danger');
      
      // Since balance check failed with error, update all other node info as well
      await updateAllNodeInfo();
    }
  }
}

// Function to update all node information when connection might be lost
async function updateAllNodeInfo() {
  // Check connection status first
  if (!isConnected) {
    // Update the connection alert
    const nodeConnectionAlert = document.getElementById('nodeConnectionAlert');
    if (nodeConnectionAlert) {
      nodeConnectionAlert.style.display = 'block';
    }
    
    // Update connection status message
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.classList.remove('text-success', 'text-warning');
      connectionStatus.classList.add('text-danger');
      connectionStatus.innerHTML = 'Disconnected from Celestia node<div class="mt-2 small">To connect, please start your node with:<br><code>celestia light start --p2p.network mocha --core.ip rpc-mocha.pops.one --core.port 9090 --rpc.skip-auth</code></div>';
    }
    
    // Since connection is lost, immediately update node address with error
    const nodeAddressElement = document.getElementById('nodeAddress');
    if (nodeAddressElement) {
      nodeAddressElement.textContent = 'Unable to fetch address. Is your node running?';
      nodeAddressElement.classList.add('text-danger');
    }
    
    // Immediately update P2P info with error
    const nodeP2PInfoElement = document.getElementById('nodeP2PInfo');
    if (nodeP2PInfoElement) {
      nodeP2PInfoElement.textContent = 'Unable to fetch P2P info. Is your node running?';
      nodeP2PInfoElement.classList.add('text-danger');
    }
    
    // Return early since connection is lost, no need to try fetching data
    return;
  }
  
  // Only try to fetch data if connected
  // Update node address
  const nodeAddressElement = document.getElementById('nodeAddress');
  if (nodeAddressElement) {
    try {
      const address = await getNodeAddress();
      if (address) {
        nodeAddressElement.textContent = address;
        nodeAddressElement.classList.remove('text-danger');
      } else {
        nodeAddressElement.textContent = 'Unable to fetch address. Is your node running?';
        nodeAddressElement.classList.add('text-danger');
      }
    } catch (error) {
      nodeAddressElement.textContent = 'Unable to fetch address. Is your node running?';
      nodeAddressElement.classList.add('text-danger');
    }
  }
  
  // Update P2P info
  const nodeP2PInfoElement = document.getElementById('nodeP2PInfo');
  if (nodeP2PInfoElement) {
    try {
      const p2pInfo = await getNodeP2PInfo();
      if (p2pInfo && p2pInfo.ID) {
        nodeP2PInfoElement.textContent = p2pInfo.ID;
        nodeP2PInfoElement.classList.remove('text-danger');
      } else {
        nodeP2PInfoElement.textContent = 'Unable to fetch P2P info. Is your node running?';
        nodeP2PInfoElement.classList.add('text-danger');
      }
    } catch (error) {
      nodeP2PInfoElement.textContent = 'Unable to fetch P2P info. Is your node running?';
      nodeP2PInfoElement.classList.add('text-danger');
    }
  }
}

// Function to transfer TIA to another address
async function transferTIA(recipientAddress, amountInTIA, gasAdjustment = 1.3) {
  try {
    // Convert TIA to utia (1 TIA = 1,000,000 utia)
    const amountInUtia = Math.floor(parseFloat(amountInTIA) * 1000000).toString();
    
    // Create a proper TxConfig object for the third parameter
    const txConfig = {
      gas_adjustment: gasAdjustment
    };
    
    console.log('Transfer parameters:', recipientAddress, amountInUtia, txConfig);
    
    // Use WebSocket to send the request
    const response = await sendRpcRequest('state.Transfer', [
      recipientAddress,
      amountInUtia,
      txConfig // Pass the TxConfig object instead of just the number
    ]);
    
    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    console.log('Transfer response:', response);
    return response.result;
  } catch (error) {
    console.error('Error transferring TIA:', error);
    throw error;
  }
}

// ==== DATABASE FUNCTIONALITY ====

// LocalStorage keys
const DB_NAMESPACE_KEY = 'celestia_db_namespace';
const DB_SCHEMA_HEIGHT_KEY = 'celestia_db_schema_height';
const DB_RECORDS_KEY = 'celestia_db_records';
const DB_AUTH_TOKEN_KEY = 'celestia_db_auth_token'; // New key for auth token

// Function to generate a secure random token for encryption
function generateAuthToken() {
  const randomBuffer = new Uint8Array(32); // 256-bit token
  window.crypto.getRandomValues(randomBuffer);
  // Convert to base64 for storage
  return btoa(String.fromCharCode.apply(null, randomBuffer));
}

// Function to get the current auth token or generate a new one
function getOrCreateAuthToken() {
  let token = localStorage.getItem(DB_AUTH_TOKEN_KEY);
  if (!token) {
    token = generateAuthToken();
    localStorage.setItem(DB_AUTH_TOKEN_KEY, token);
  }
  return token;
}

// Simple encryption function using AES-GCM
async function encryptData(data, token) {
  // Convert token to key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  const key = await crypto.subtle.importKey(
    'raw', 
    hash, 
    { name: 'AES-GCM' }, 
    false, 
    ['encrypt']
  );
  
  // Generate IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const dataBuffer = encoder.encode(data);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  // Combine IV and encrypted data for storage
  const encryptedArray = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  encryptedArray.set(iv, 0);
  encryptedArray.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode.apply(null, encryptedArray));
}

// Simple decryption function using AES-GCM
async function decryptData(encryptedBase64, token) {
  try {
    // Convert base64 to array
    const encryptedString = atob(encryptedBase64);
    const encryptedArray = new Uint8Array(encryptedString.length);
    for (let i = 0; i < encryptedString.length; i++) {
      encryptedArray[i] = encryptedString.charCodeAt(i);
    }
    
    // Extract IV and encrypted data
    const iv = encryptedArray.slice(0, 12);
    const encryptedData = encryptedArray.slice(12);
    
    // Convert token to key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(token);
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    const key = await crypto.subtle.importKey(
      'raw', 
      hash, 
      { name: 'AES-GCM' }, 
      false, 
      ['decrypt']
    );
    
    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data. The authentication token may have changed.');
  }
}

// Function to clear database cache
function clearDatabaseCache() {
    localStorage.removeItem(DB_NAMESPACE_KEY);
    localStorage.removeItem(DB_SCHEMA_HEIGHT_KEY);
    localStorage.removeItem(DB_RECORDS_KEY);
    localStorage.removeItem(DB_AUTH_TOKEN_KEY); // Clear the auth token as well
    
    // Update UI
    updateDatabaseInfoPanel();
    
    // Clear any displayed records and schema
    const recordsTableBody = document.getElementById('recordsTableBody');
    if (recordsTableBody) {
        recordsTableBody.innerHTML = '';
    }
    
    document.getElementById('recordsTable').style.display = 'none';
    document.getElementById('noRecordsMsg').style.display = 'block';
    document.getElementById('schemaViewSection').style.display = 'none';
}

// Function to initialize a new database
async function initializeDatabase(namespace, schema) {
    try {
        // Validate inputs
        if (!namespace) {
            throw new Error('Database namespace is required');
        }
        
        if (!schema) {
            throw new Error('Database schema is required');
        }
        
        // Validate schema is valid JSON
        let schemaObj;
        try {
            schemaObj = JSON.parse(schema);
        } catch (error) {
            throw new Error('Invalid schema format. Please provide valid JSON.');
        }
        
        // Create the schema object with metadata
        const dbSchema = {
            schema: schemaObj,
            createdAt: new Date().toISOString(),
            version: '1.0'
        };
        
        // Get or create auth token
        const token = getOrCreateAuthToken();
        
        // Convert schema to JSON and encrypt it
        const schemaJson = JSON.stringify(dbSchema);
        const encryptedSchema = await encryptData(schemaJson, token);
        
        // Convert encrypted schema to base64
        const schemaBase64 = encodeToBase64(encryptedSchema);
        
        console.log('Initializing database with schema (encrypted)');
        
        // Submit schema as a blob
        const result = await submitBlob(namespace, schemaBase64);
        
        if (!result) {
            throw new Error('Failed to initialize database');
        }
        
        console.log('Database initialized, result:', result);
        
        // Store database info in localStorage
        localStorage.setItem(DB_NAMESPACE_KEY, namespace);
        localStorage.setItem(DB_SCHEMA_HEIGHT_KEY, result.height);
        localStorage.setItem(DB_RECORDS_KEY, JSON.stringify([]));
        
        return {
            namespace,
            schemaHeight: result.height
        };
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Function to add a record to the database
async function addDatabaseRecord(data) {
    try {
        // Get database info from localStorage
        const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
        const schemaHeight = localStorage.getItem(DB_SCHEMA_HEIGHT_KEY);
        
        if (!namespace || !schemaHeight) {
            throw new Error('Database not initialized. Please initialize the database first.');
        }
        
        // Validate data is valid JSON
        let dataObj;
        try {
            dataObj = JSON.parse(data);
        } catch (error) {
            throw new Error('Invalid data format. Please provide valid JSON.');
        }
        
        // Create the record object with metadata
        const record = {
            data: dataObj,
            createdAt: new Date().toISOString()
        };
        
        // Get auth token
        const token = getOrCreateAuthToken();
        
        // Convert record to JSON and encrypt it
        const recordJson = JSON.stringify(record);
        const encryptedRecord = await encryptData(recordJson, token);
        
        // Convert encrypted record to base64
        const recordBase64 = encodeToBase64(encryptedRecord);
        
        // Submit record as a blob
        const result = await submitBlob(namespace, recordBase64);
        
        if (!result) {
            throw new Error('Failed to add record to database');
        }
        
        // Update records list in localStorage
        const recordsList = JSON.parse(localStorage.getItem(DB_RECORDS_KEY) || '[]');
        recordsList.push({
            height: result.height,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(recordsList));
        
        return {
            height: result.height,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error adding record to database:', error);
        throw error;
    }
}

// Function to retrieve database schema
async function retrieveDatabaseSchema() {
    try {
        const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
        const schemaHeight = localStorage.getItem(DB_SCHEMA_HEIGHT_KEY);
        
        if (!namespace || !schemaHeight) {
            throw new Error('Database not initialized');
        }
        
        // Get auth token
        const token = getOrCreateAuthToken();
        
        // Convert namespace to hex
        const namespaceHex = base64ToHex(namespace);
        
        // Retrieve schema blob
        const schemaBlob = await retrieveBlob(schemaHeight, namespaceHex);
        
        if (!schemaBlob || !schemaBlob.data) {
            console.error('Failed to retrieve schema blob:', schemaBlob);
            throw new Error('Failed to retrieve database schema');
        }
        
        // Decode schema from base64
        const encryptedSchemaBase64 = decodeFromBase64(schemaBlob.data);
        
        // Decrypt schema
        try {
            const schemaJson = await decryptData(encryptedSchemaBase64, token);
            console.log('Retrieved and decrypted schema JSON');
            
            return JSON.parse(schemaJson);
        } catch (decryptError) {
            console.error('Error decrypting schema:', decryptError);
            throw new Error('Failed to decrypt schema. The authentication token may have changed.');
        }
    } catch (error) {
        console.error('Error retrieving database schema:', error);
        throw error;
    }
}

// Function to retrieve database records
async function retrieveDatabaseRecords() {
    try {
        const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
        const recordsList = JSON.parse(localStorage.getItem(DB_RECORDS_KEY) || '[]');
        
        if (!namespace) {
            throw new Error('Database not initialized');
        }
        
        if (recordsList.length === 0) {
            return [];
        }
        
        // Get auth token
        const token = getOrCreateAuthToken();
        
        // Convert namespace to hex
        const namespaceHex = base64ToHex(namespace);
        
        // Retrieve all records
        const records = [];
        
        for (const recordInfo of recordsList) {
            try {
                const recordBlob = await retrieveBlob(recordInfo.height, namespaceHex);
                
                if (!recordBlob || !recordBlob.data) {
                    console.warn(`Failed to retrieve record at height ${recordInfo.height}`);
                    continue;
                }
                
                // Decode record from base64
                const encryptedRecordBase64 = decodeFromBase64(recordBlob.data);
                
                // Decrypt record
                try {
                    const recordJson = await decryptData(encryptedRecordBase64, token);
                    const record = JSON.parse(recordJson);
                    
                    records.push({
                        ...record,
                        height: recordInfo.height
                    });
                } catch (decryptError) {
                    console.error(`Error decrypting record at height ${recordInfo.height}:`, decryptError);
                    // Continue with other records even if one fails
                }
            } catch (error) {
                console.error(`Error retrieving record at height ${recordInfo.height}:`, error);
                // Continue with other records even if one fails
            }
        }
        
        return records;
    } catch (error) {
        console.error('Error retrieving database records:', error);
        throw error;
    }
}

// Function to display database records in the table
async function displayDatabaseRecords() {
    try {
        // Check if database is initialized
        const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
        if (!namespace) {
            console.warn('Database not initialized. Cannot display records.');
            return;
        }
        
        const recordsTableBody = document.getElementById('recordsTableBody');
        if (!recordsTableBody) {
            console.error('Records table body element not found');
            return;
        }
        
        // Clear existing records
        recordsTableBody.innerHTML = '';
        
        // Show loading
        document.getElementById('recordsLoading').style.display = 'block';
        document.getElementById('recordsError').style.display = 'none';
        
        try {
            // Retrieve records
            const records = await retrieveDatabaseRecords();
            
            if (records.length === 0) {
                document.getElementById('recordsTable').style.display = 'none';
                document.getElementById('noRecordsMsg').style.display = 'block';
                return;
            }
            
            // Display records
            let index = 1;
            records.forEach(record => {
                const row = document.createElement('tr');
                
                // Extract data
                const timestamp = record.createdAt ? new Date(record.createdAt).toLocaleString() : 'N/A';
                const height = record.height || 'N/A';
                const data = JSON.stringify(record.data, null, 2);
                
                // Create cells with correct column order: # (index), Data, Height, Timestamp
                row.innerHTML = `
                    <td>${index++}</td>
                    <td><pre class="mb-0">${data}</pre></td>
                    <td>${height}</td>
                    <td>${timestamp}</td>
                `;
                
                recordsTableBody.appendChild(row);
            });
            
            // Show the table
            document.getElementById('recordsTable').style.display = 'table';
            document.getElementById('noRecordsMsg').style.display = 'none';
        } catch (error) {
            console.error('Error retrieving records:', error);
            
            // Show error message
            const errorElement = document.getElementById('recordsError');
            errorElement.style.display = 'block';
            
            // Customize error message based on type
            if (error.message && error.message.includes('decrypt')) {
                errorElement.innerHTML = `
                    <strong>Encryption Key Error</strong>
                    <p>Unable to decrypt your database records. This happens when:</p>
                    <ul>
                        <li>You've cleared your browser data since creating the database</li>
                        <li>You've loaded this app in a different browser</li>
                        <li>You've cleared the database cache and are trying to access old data</li>
                    </ul>
                    <p>The data exists on the blockchain but cannot be decrypted without the original encryption key.</p>
                `;
            } else {
                errorElement.textContent = `Error: ${error.message}`;
            }
            
            // Hide the table
            document.getElementById('recordsTable').style.display = 'none';
            document.getElementById('noRecordsMsg').style.display = 'none';
        } finally {
            // Hide loading
            document.getElementById('recordsLoading').style.display = 'none';
        }
    } catch (error) {
        console.error('Error displaying records:', error);
    }
}

// Function to display the schema in the UI
async function displayDatabaseSchema() {
    try {
        // Check if schema view section exists
        const schemaViewSection = document.getElementById('schemaViewSection');
        if (!schemaViewSection) {
            return;
        }
        
        // Check if database is initialized
        const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
        const schemaHeight = localStorage.getItem(DB_SCHEMA_HEIGHT_KEY);
        
        if (!namespace || !schemaHeight) {
            schemaViewSection.style.display = 'none';
            return;
        }
        
        // Show loading
        document.getElementById('schemaLoading').style.display = 'block';
        document.getElementById('schemaError').style.display = 'none';
        schemaViewSection.style.display = 'block';
        
        try {
            // Retrieve schema
            const schemaData = await retrieveDatabaseSchema();
            
            if (!schemaData || !schemaData.schema) {
                throw new Error('Invalid schema format');
            }
            
            // Display schema
            const schemaDisplay = document.getElementById('schemaDisplay');
            if (schemaDisplay) {
                schemaDisplay.textContent = JSON.stringify(schemaData.schema, null, 2);
            }
            
            // Display metadata
            const schemaMetadata = document.getElementById('schemaMetadata');
            if (schemaMetadata) {
                const createdDate = schemaData.createdAt ? new Date(schemaData.createdAt).toLocaleString() : 'Unknown';
                const version = schemaData.version || 'Unknown';
                
                schemaMetadata.innerHTML = `
                    <strong>Created:</strong> ${createdDate}<br>
                    <strong>Version:</strong> ${version}<br>
                    <strong>Height:</strong> ${schemaHeight}
                `;
            }
        } catch (error) {
            console.error('Error retrieving schema:', error);
            
            // Show error message
            const errorElement = document.getElementById('schemaError');
            if (errorElement) {
                errorElement.style.display = 'block';
                
                // Customize error message based on type
                if (error.message && error.message.includes('decrypt')) {
                    errorElement.innerHTML = `
                        <strong>Encryption Key Error</strong>
                        <p>Unable to decrypt your database schema. This happens when:</p>
                        <ul>
                            <li>You've cleared your browser data since creating the database</li>
                            <li>You've loaded this app in a different browser</li>
                            <li>You've cleared the database cache and are trying to access old data</li>
                        </ul>
                        <p>The schema exists on the blockchain but cannot be decrypted without the original encryption key.</p>
                    `;
                } else {
                    errorElement.textContent = `Error: ${error.message}`;
                }
            }
        } finally {
            // Hide loading
            document.getElementById('schemaLoading').style.display = 'none';
        }
    } catch (error) {
        console.error('Error displaying schema:', error);
    }
}

// Function to update the database info panel
function updateDatabaseInfoPanel() {
    const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
    const schemaHeight = localStorage.getItem(DB_SCHEMA_HEIGHT_KEY);
    const recordsList = JSON.parse(localStorage.getItem(DB_RECORDS_KEY) || '[]');
    const authToken = localStorage.getItem(DB_AUTH_TOKEN_KEY);
    
    const dbInfoNamespace = document.getElementById('dbInfoNamespace');
    const dbInfoSchemaHeight = document.getElementById('dbInfoSchemaHeight');
    const dbInfoLastUpdated = document.getElementById('dbInfoLastUpdated');
    const dbInfoStatus = document.getElementById('dbInfoStatus');
    const dbRecordCount = document.getElementById('dbRecordCount');
    const dbEncryptionStatus = document.getElementById('dbEncryptionStatus');
    const dbInfoNamespaceLink = document.getElementById('dbInfoNamespaceLink');
    
    if (namespace && schemaHeight) {
        // Database is initialized
        dbInfoNamespace.textContent = namespace;
        dbInfoSchemaHeight.textContent = schemaHeight;
        
        // Update namespace link
        if (dbInfoNamespaceLink) {
            const namespaceHex = base64ToHex(namespace);
            dbInfoNamespaceLink.href = `https://mocha.celenium.io/namespace/000000000000000000000000000000000000${namespaceHex}?tab=Blobs`;
            dbInfoNamespaceLink.style.display = 'inline-block';
        }
        
        if (recordsList.length > 0) {
            // Get the most recent record timestamp
            const latestRecord = recordsList.reduce((latest, record) => {
                return new Date(record.timestamp) > new Date(latest.timestamp) ? record : latest;
            }, recordsList[0]);
            
            dbInfoLastUpdated.textContent = new Date(latestRecord.timestamp).toLocaleString();
        } else {
            dbInfoLastUpdated.textContent = 'No records yet';
        }
        
        dbInfoStatus.textContent = 'Active';
        dbInfoStatus.className = 'badge bg-success';
        dbRecordCount.textContent = `${recordsList.length} Records`;
        
        // Update encryption status
        if (authToken) {
            dbEncryptionStatus.textContent = 'Encrypted';
            dbEncryptionStatus.className = 'badge bg-success';
        } else {
            dbEncryptionStatus.textContent = 'Not Encrypted';
            dbEncryptionStatus.className = 'badge bg-warning';
        }
        
        // Show the records table and hide the no records message
        if (recordsList.length > 0) {
            document.getElementById('recordsTable').style.display = 'table';
            document.getElementById('noRecordsMsg').style.display = 'none';
        } else {
            document.getElementById('recordsTable').style.display = 'none';
            document.getElementById('noRecordsMsg').style.display = 'block';
        }
    } else {
        // Database is not initialized
        dbInfoNamespace.textContent = 'Not set';
        dbInfoSchemaHeight.textContent = 'Not set';
        dbInfoLastUpdated.textContent = 'Never';
        dbInfoStatus.textContent = 'Not Initialized';
        dbInfoStatus.className = 'badge bg-secondary';
        dbRecordCount.textContent = '0 Records';
        
        // Hide namespace link
        if (dbInfoNamespaceLink) {
            dbInfoNamespaceLink.style.display = 'none';
        }
        
        // Update encryption status
        dbEncryptionStatus.textContent = 'Not Encrypted';
        dbEncryptionStatus.className = 'badge bg-secondary';
        
        // Hide the records table and show the no records message
        document.getElementById('recordsTable').style.display = 'none';
        document.getElementById('noRecordsMsg').style.display = 'block';
    }
} 