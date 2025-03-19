import axios from 'axios';
import { Buffer } from 'buffer';
import { Client, RequestManager, WebSocketTransport, JSONRPCError } from '@open-rpc/client-js';

// Configuration for the Celestia node - hardcoded to localhost:26658
const CELESTIA_NODE_URL = 'ws://localhost:26658';

// WebSocket client for RPC
let wsClient = null;

// Initialize WebSocket client
async function initWebSocketClient() {
  try {
    const transport = new WebSocketTransport(CELESTIA_NODE_URL);
    
    // Set up error handler
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      transport.connection.onopen = () => {
        const requestManager = new RequestManager([transport]);
        wsClient = new Client(requestManager);
        resolved = true;
        resolve(true);
      };
      
      transport.connection.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        if (!resolved) {
          reject(new Error('Failed to connect to the Celestia node. Ensure your node is running at ' + CELESTIA_NODE_URL));
        }
      };
      
      // Set a timeout to avoid hanging if the connection never establishes
      setTimeout(() => {
        if (!resolved) {
          transport.connection.close();
          reject(new Error('Connection timeout. The Celestia node is not responding.'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Failed to initialize WebSocket client:', error);
    return false;
  }
}

// Make RPC call using WebSocket
async function makeRpcCall(method, params = []) {
  try {
    // Check if we have a client
    if (!wsClient) {
      const initialized = await initWebSocketClient();
      if (!initialized) {
        throw new Error('Failed to connect to Celestia node at ' + CELESTIA_NODE_URL);
      }
    }
    
    // Make request
    const response = await wsClient.request({ method, params });
    return response;
  } catch (error) {
    if (error instanceof JSONRPCError) {
      console.error(`RPC Error (${error.code}): ${error.message}`);
    } else {
      console.error('RPC call failed:', error);
    }
    throw error;
  }
}

// Function to test connection and update status indicator
async function testConnection() {
  try {
    // Try to get node address as a simple test
    await getNodeAddress();
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

// Update the connection status indicator
async function updateConnectionStatus() {
  const connectionIndicator = document.getElementById('connection-status');
  
  if (!connectionIndicator) return;
  
  const isConnected = await testConnection();
  
  if (isConnected) {
    connectionIndicator.className = 'badge bg-success';
    connectionIndicator.textContent = 'Connected';
  } else {
    connectionIndicator.className = 'badge bg-danger';
    connectionIndicator.textContent = 'Disconnected';
  }
}

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
    const response = await makeRpcCall('state.AccountAddress');
    return response;
  } catch (error) {
    console.error('Failed to get node address:', error);
    throw error;
  }
}

// Function to get the node's balance
async function getNodeBalance() {
  try {
    const response = await makeRpcCall('state.Balance');
    return response;
  } catch (error) {
    console.error('Failed to get node balance:', error);
    throw error;
  }
}

// Function to get the node's P2P info
async function getP2PInfo() {
  try {
    const response = await makeRpcCall('p2p.Info');
    return response;
  } catch (error) {
    console.error('Failed to get P2P info:', error);
    throw error;
  }
}

// Function to get DAS sampling stats
async function getDasSamplingStats() {
  try {
    const response = await makeRpcCall('das.SamplingStats');
    return response;
  } catch (error) {
    console.error('Failed to get DAS sampling stats:', error);
    return null; // Return null for optional stats
  }
}

// Function to submit a blob to the Celestia network
async function submitBlob(namespace, data, gasPrice = 0.002) {
  // First check if we're connected
  const isConnected = await testConnection();
  if (!isConnected) {
    throw new Error('Not connected to Celestia node. Please check your connection settings.');
  }

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

    // Set gas price option
    const options = { gas_price: gasPrice };

    // Make the RPC call
    const response = await makeRpcCall('blob.Submit', [[blob], options]);

    // Convert namespace to hex for display
    const namespaceHex = base64ToHex(namespace);

    // Return the height and namespace information
    return {
      height: response,
      namespaceHex: namespaceHex,
      namespaceBase64: namespace
    };
  } catch (error) {
    console.error('Error submitting blob:', error);
    throw error;
  }
}

// Function to retrieve a blob from the Celestia network
async function getBlob(height, namespace, commitment) {
  try {
    const params = [height, namespace];
    if (commitment) {
      params.push(commitment);
    }
    const response = await makeRpcCall('blob.Get', params);
    return response;
  } catch (error) {
    console.error('Failed to get blob:', error);
    throw error;
  }
}

// Function to transfer TIA tokens
async function transferTIA(recipient, amount, gasAmount, gasPrice) {
  try {
    const params = [
      recipient,
      amount,
      { gas_limit: gasAmount, gas_price: gasPrice }
    ];
    const response = await makeRpcCall('state.Transfer', params);
    return response;
  } catch (error) {
    console.error('Failed to transfer TIA:', error);
    throw error;
  }
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

// Function to retrieve a blob by height and namespace
async function retrieveBlob(heightValue, namespaceHex, commitment = '') {
  try {
    console.log(`Retrieving blob from height ${heightValue} with namespace ${namespaceHex}`);

    // Convert hex namespace to base64
    const namespaceBase64 = hexToBase64(namespaceHex);

    // Prepare parameters
    const params = [heightValue, namespaceBase64];
    if (commitment) {
      params.push(commitment);
    }

    // Make the RPC call
    const blobs = await makeRpcCall('blob.Get', params);
    
    return blobs;
  } catch (error) {
    console.error('Error retrieving blob:', error);
    throw error;
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
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize WebSocket connection
    await initWebSocketClient();

    // Update node information periodically
    updateNodeInfo();
    setInterval(updateNodeInfo, 30000); // Update every 30 seconds
    
    // Generate a random namespace
    const randomNamespace = generateRandomNamespace();
    randomNamespaceInput.value = randomNamespace.base64;
    randomNamespaceHex.textContent = randomNamespace.hex;
    
    // Fetch and display node address
    const address = await getNodeAddress();
    if (nodeAddressElement) {
      nodeAddressElement.textContent = address;
    }
    
    // Fetch and display P2P info
    const p2pInfo = await getP2PInfo();
    if (nodeP2PInfoElement) {
      if (p2pInfo && p2pInfo.ID) {
        nodeP2PInfoElement.textContent = p2pInfo.ID;
      } else {
        nodeP2PInfoElement.textContent = 'N/A';
        console.error('Failed to get P2P info:', p2pInfo);
      }
    }
    
    // Fetch and display node balance
    await refreshNodeBalance();
    
    // Fetch and display sampling stats
    const samplingStats = await getDasSamplingStats();
    if (samplingStats) {
      updateSamplingStats(samplingStats);
      
      // Initialize real-time streaming for sampling stats
      const isStreamingSupported = setupRealtimeSamplingStats();
      
      // Fall back to polling if streaming is not supported
      if (!isStreamingSupported) {
        console.log('Falling back to polling for sampling stats');
        // Set up a refresh interval for sampling stats (every 5 seconds)
        setInterval(async () => {
          const updatedStats = await getDasSamplingStats();
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
          const updatedStats = await getDasSamplingStats();
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
    // First check connection status
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Not connected to Celestia node. Please check your connection settings and ensure your node is running.');
    }
    
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
    
    // Submit the blob
    const result = await submitBlob(namespace, data, gasPrice);
    
    // Show success result
    updateResultContainer(result);
    
  } catch (error) {
    // Display error message
    console.error('Error submitting blob:', error);
    errorMessageElement.textContent = error.message || 'An error occurred while submitting the blob.';
    errorMessageElement.style.display = 'block';
    
    // Also show as toast for visibility
    showToast(`Error: ${error.message || 'Failed to submit blob'}`, 'error');
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
function showToast(message, type = 'info') {
  // Find or create toast container
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  // Add type-specific class
  if (type === 'error') {
    toast.classList.add('error');
  } else if (type === 'success') {
    toast.classList.add('success');
  }
  
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  // Trigger reflow to enable transition
  toast.offsetHeight;
  toast.classList.add('show');
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, 3000);
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

// Function to refresh the node balance
async function refreshNodeBalance() {
  const nodeBalanceElement = document.getElementById('nodeBalance');
  const balance = await getNodeBalance();
  if (nodeBalanceElement) {
    // Add animation to highlight the updated balance
    nodeBalanceElement.textContent = balance;
    nodeBalanceElement.classList.remove('value-changed');
    // Force reflow to restart animation
    void nodeBalanceElement.offsetWidth;
    nodeBalanceElement.classList.add('value-changed');
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
    
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'state.Transfer',
      params: [
        recipientAddress,
        amountInUtia,
        txConfig // Pass the TxConfig object instead of just the number
      ]
    };

    console.log('Transfer payload:', payload);
    const response = await makeRpcCall('state.Transfer', payload);
    
    if (response.error) {
      throw new Error(`RPC Error: ${response.error.message}`);
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
    
    if (namespace && schemaHeight) {
        // Database is initialized
        dbInfoNamespace.textContent = namespace;
        dbInfoSchemaHeight.textContent = schemaHeight;
        
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
        
        // Update encryption status
        dbEncryptionStatus.textContent = 'Not Encrypted';
        dbEncryptionStatus.className = 'badge bg-secondary';
        
        // Hide the records table and show the no records message
        document.getElementById('recordsTable').style.display = 'none';
        document.getElementById('noRecordsMsg').style.display = 'block';
    }
} 