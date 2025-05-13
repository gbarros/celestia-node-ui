/**
 * Common utility functions used across the application
 */

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
export const RESERVED_NAMESPACES = {
  // Primary reserved namespaces (version 0)
  TRANSACTION_NAMESPACE: '0000000000000000000000000000000000000000000000000000000001',
  INTERMEDIATE_STATE_ROOT_NAMESPACE: '0000000000000000000000000000000000000000000000000000000002',
  PAY_FOR_BLOB_NAMESPACE: '0000000000000000000000000000000000000000000000000000000004',
  PRIMARY_RESERVED_PADDING_NAMESPACE: '00000000000000000000000000000000000000000000000000000000FF',
  
  // Secondary reserved namespaces (version 255)
  TAIL_PADDING_NAMESPACE: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE',
  SECONDARY_RESERVED_PADDING_NAMESPACE: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFD'
};

/**
 * Convert base64 to hex
 * @param {string} base64 - Base64 string to convert
 * @returns {string} - Hex string
 */
export function base64ToHex(base64) {
  try {
    // Remove padding if present
    const cleanBase64 = base64.replace(/=/g, '');
    
    // Decode base64 to binary
    const binaryString = atob(cleanBase64);
    
    // Convert binary to hex
    let hexString = '';
    for (let i = 0; i < binaryString.length; i++) {
      const hex = binaryString.charCodeAt(i).toString(16);
      hexString += hex.length === 1 ? '0' + hex : hex;
    }
    
    return hexString.toUpperCase();
  } catch (error) {
    console.error('Error converting base64 to hex:', error);
    return '';
  }
}

/**
 * Convert hex to base64
 * @param {string} hex - Hex string to convert
 * @returns {string} - Base64 string
 */
export function hexToBase64(hex) {
  try {
    // Convert hex to binary
    const hexString = hex.replace(/^0x/, '');
    let binaryString = '';
    for (let i = 0; i < hexString.length; i += 2) {
      binaryString += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
    }
    
    // Convert binary to base64
    return btoa(binaryString);
  } catch (error) {
    console.error('Error converting hex to base64:', error);
    return '';
  }
}

/**
 * Check if a namespace is reserved
 * @param {string} base64Namespace - Base64 encoded namespace
 * @returns {boolean} - True if reserved, false otherwise
 */
export function isReservedNamespace(base64Namespace) {
  try {
    const hexNamespace = base64ToHex(base64Namespace);
    
    for (const reservedNamespace of Object.values(RESERVED_NAMESPACES)) {
      if (hexNamespace === reservedNamespace) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if namespace is reserved:', error);
    return false;
  }
}

/**
 * Validate a namespace according to Celestia specifications
 * @param {string} base64Namespace - Base64 encoded namespace
 * @returns {Object} - Validation result with isValid and error properties
 */
export function validateNamespace(base64Namespace) {
  try {
    // Check if it's a valid base64 string
    if (!isValidBase64(base64Namespace)) {
      return {
        isValid: false,
        error: 'Invalid base64 encoding'
      };
    }
    
    // Convert to hex to check the length and version
    const hexNamespace = base64ToHex(base64Namespace);
    
    // Check length (must be 29 bytes = 58 hex characters)
    if (hexNamespace.length !== 58) {
      return {
        isValid: false,
        error: `Namespace must be 29 bytes (got ${Math.floor(hexNamespace.length / 2)} bytes)`
      };
    }
    
    // Check version (first byte)
    const version = parseInt(hexNamespace.substring(0, 2), 16);
    if (version !== 0 && version !== 255) {
      return {
        isValid: false,
        error: `Invalid namespace version: ${version} (must be 0 or 255)`
      };
    }
    
    // Check if it's a reserved namespace
    if (isReservedNamespace(base64Namespace)) {
      return {
        isValid: false,
        error: 'This is a reserved namespace and cannot be used'
      };
    }
    
    return {
      isValid: true,
      error: null
    };
  } catch (error) {
    console.error('Error validating namespace:', error);
    return {
      isValid: false,
      error: 'Error validating namespace: ' + error.message
    };
  }
}

/**
 * Generate a random namespace
 * @returns {Object} - Object with base64, hex, and plaintext properties
 */
export function generateRandomNamespace() {
  // Generate a readable name using random adjective and noun
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const plaintext = `${adjective}-${noun}`;
  
  // Create a valid namespace from the plaintext
  return createValidNamespace(plaintext);
}

/**
 * Create a valid namespace from input text
 * @param {string} input - Input text to create namespace from
 * @returns {Object} - Object with base64, hex, and plaintext properties
 */
export function createValidNamespace(input) {
  try {
    // Convert input to bytes
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(input);
    
    // Create a 29-byte array (version 0 + 28 bytes of data)
    const namespaceBytes = new Uint8Array(29);
    
    // Set version to 0
    namespaceBytes[0] = 0;
    
    // Copy input bytes (up to 28 bytes)
    const bytesToCopy = Math.min(inputBytes.length, 28);
    for (let i = 0; i < bytesToCopy; i++) {
      namespaceBytes[i + 1] = inputBytes[i];
    }
    
    // Convert to base64
    const base64 = btoa(String.fromCharCode.apply(null, namespaceBytes));
    
    // Convert to hex
    let hex = '';
    for (let i = 0; i < namespaceBytes.length; i++) {
      const byteHex = namespaceBytes[i].toString(16).padStart(2, '0');
      hex += byteHex;
    }
    
    return {
      base64,
      hex: hex.toUpperCase(),
      plaintext: input
    };
  } catch (error) {
    console.error('Error creating valid namespace:', error);
    return {
      base64: '',
      hex: '',
      plaintext: input
    };
  }
}

/**
 * Check if a string is valid base64
 * @param {string} str - String to check
 * @returns {boolean} - True if valid base64, false otherwise
 */
export function isValidBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch (error) {
    return false;
  }
}

/**
 * Safely encode text to base64
 * @param {string} text - Text to encode
 * @returns {string} - Base64 encoded string
 */
export function encodeToBase64(text) {
  try {
    return btoa(text);
  } catch (error) {
    console.error('Error encoding to base64:', error);
    return '';
  }
}

/**
 * Safely decode base64 to text
 * @param {string} base64 - Base64 string to decode
 * @returns {string} - Decoded text
 */
export function decodeFromBase64(base64) {
  try {
    return atob(base64);
  } catch (error) {
    console.error('Error decoding from base64:', error);
    return '';
  }
}

/**
 * Show a toast notification
 * @param {string} message - Message to show
 */
export function showToast(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Trigger reflow to enable animation
  void toast.offsetWidth;
  
  // Show the toast
  toast.classList.add('show');
  
  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300); // Wait for fade out animation
  }, 3000);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Promise that resolves to true if successful
 */
export function copyToClipboard(text) {
  return navigator.clipboard.writeText(text)
    .then(() => {
      showToast('Copied to clipboard');
      return true;
    })
    .catch(error => {
      console.error('Error copying to clipboard:', error);
      return false;
    });
}

/**
 * Check if base64 data is an image
 * @param {string} base64 - Base64 data to check
 * @returns {boolean} - True if image, false otherwise
 */
export function isBase64Image(base64) {
  // Check for common image signatures in base64
  const signatures = [
    'iVBORw0', // PNG
    '/9j/4', // JPEG
    'R0lGOD', // GIF
    'UklGR', // WEBP
    'PD94bWw' // SVG (XML)
  ];
  
  for (const signature of signatures) {
    if (base64.startsWith(signature)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Format base64 data for display
 * @param {string} base64 - Base64 data to format
 * @returns {Object} - Object with html and type properties
 */
export function formatBase64ForDisplay(base64) {
  // Check if it's an image
  if (isBase64Image(base64)) {
    return {
      html: `<img src="data:image/png;base64,${base64}" class="img-fluid" alt="Blob image data">`,
      type: 'image'
    };
  }
  
  // Try to decode as text
  try {
    const text = atob(base64);
    
    // Check if it's JSON
    try {
      const json = JSON.parse(text);
      return {
        html: `<pre>${JSON.stringify(json, null, 2)}</pre>`,
        type: 'json'
      };
    } catch {
      // Not JSON, check if it's printable text
      const isPrintable = /^[\x20-\x7E\r\n\t]*$/.test(text);
      if (isPrintable) {
        return {
          html: `<pre>${text}</pre>`,
          type: 'text'
        };
      }
    }
  } catch {
    // Not decodable as text
  }
  
  // Default to showing as base64
  return {
    html: `<pre>${base64}</pre>`,
    type: 'base64'
  };
}
