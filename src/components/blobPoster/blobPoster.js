import { sendRpcRequest } from '../../services/websocket.js';
import { 
  isValidBase64, 
  validateNamespace, 
  generateRandomNamespace, 
  createValidNamespace,
  base64ToHex,
  encodeToBase64,
  decodeFromBase64,
  showToast,
  copyToClipboard,
  isBase64Image,
  formatBase64ForDisplay
} from '../../utils/common.js';

/**
 * Initialize the Blob Poster tab
 */
export function initBlobPosterTab() {
  // DOM Elements
  const blobForm = document.getElementById('blobForm');
  const namespaceTypeRadios = document.querySelectorAll('input[name="namespaceType"]');
  const base64NamespaceInput = document.getElementById('base64NamespaceInput');
  const hexNamespaceInput = document.getElementById('hexNamespaceInput');
  const randomNamespaceInput = document.getElementById('randomNamespaceInput');
  const plainTextNamespaceInput = document.getElementById('plainTextNamespaceInput');
  const namespaceInputGroups = document.querySelectorAll('.namespace-input-group');
  const namespacePreview = document.getElementById('namespacePreview');
  const namespacePreviewHex = document.getElementById('namespacePreviewHex');
  const namespaceError = document.getElementById('namespaceError');
  const blobDataInput = document.getElementById('blobData');
  const resultContainer = document.getElementById('resultContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  const rawTextInput = document.getElementById('rawText');
  const base64Input = document.getElementById('base64Text');
  const encodeBtn = document.getElementById('encodeBtn');
  const decodeBtn = document.getElementById('decodeBtn');
  const retrieveForm = document.getElementById('retrieveForm');
  const retrieveHeight = document.getElementById('retrieveHeight');
  const retrieveNamespace = document.getElementById('retrieveNamespace');
  const blobResults = document.getElementById('blobResults');
  const blobDataContainer = document.getElementById('blobDataContainer');
  const retrieveLoadingIndicator = document.getElementById('retrieveLoadingIndicator');
  const retrieveErrorMessage = document.getElementById('retrieveErrorMessage');
  const generateRandomNamespaceBtn = document.getElementById('generateRandomNamespace');
  
  // Generate a random namespace
  const randomNamespace = generateRandomNamespace();
  if (randomNamespaceInput) {
    randomNamespaceInput.value = randomNamespace.base64;
    randomNamespaceInput.setAttribute('data-plaintext', randomNamespace.plaintext);
    randomNamespaceInput.setAttribute('data-hex', randomNamespace.hex);
  }
  
  // Set up event listeners for namespace type selection
  if (namespaceTypeRadios) {
    namespaceTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const selectedType = document.querySelector('input[name="namespaceType"]:checked').value;
        
        // Hide all namespace input groups
        namespaceInputGroups.forEach(group => {
          group.classList.remove('active');
        });
        
        // Show the selected input group
        const selectedGroup = document.getElementById(`${selectedType}NamespaceGroup`);
        if (selectedGroup) {
          selectedGroup.classList.add('active');
        }
        
        // Hide namespace preview
        if (namespacePreview) {
          namespacePreview.classList.remove('active');
        }
      });
    });
  }
  
  // Set up event listener for base64 namespace input
  if (base64NamespaceInput) {
    base64NamespaceInput.addEventListener('input', () => {
      const base64 = base64NamespaceInput.value.trim();
      if (base64 && isValidBase64(base64)) {
        const validation = validateNamespace(base64);
        
        if (validation.isValid) {
          // Show namespace preview
          if (namespacePreview) {
            namespacePreview.classList.add('active');
            namespacePreviewHex.textContent = base64ToHex(base64);
          }
          
          // Clear any previous error
          if (namespaceError) {
            namespaceError.style.display = 'none';
          }
        } else {
          // Show error
          if (namespaceError) {
            namespaceError.textContent = validation.error;
            namespaceError.style.display = 'block';
          }
          
          // Hide namespace preview
          if (namespacePreview) {
            namespacePreview.classList.remove('active');
          }
        }
      } else {
        // Hide namespace preview
        if (namespacePreview) {
          namespacePreview.classList.remove('active');
        }
        
        // Clear any previous error
        if (namespaceError) {
          namespaceError.style.display = 'none';
        }
      }
    });
  }
  
  // Set up event listener for hex namespace input
  if (hexNamespaceInput) {
    hexNamespaceInput.addEventListener('input', () => {
      // TODO: Implement hex namespace validation and preview
    });
  }
  
  // Set up event listener for plain text namespace input
  if (plainTextNamespaceInput) {
    plainTextNamespaceInput.addEventListener('input', () => {
      const plainText = plainTextNamespaceInput.value.trim();
      if (plainText) {
        const namespace = createValidNamespace(plainText);
        
        // Show namespace preview
        if (namespacePreview) {
          namespacePreview.classList.add('active');
          namespacePreviewHex.textContent = namespace.hex;
        }
      } else {
        // Hide namespace preview
        if (namespacePreview) {
          namespacePreview.classList.remove('active');
        }
      }
    });
  }
  
  // Set up event listener for generate random namespace button
  if (generateRandomNamespaceBtn) {
    generateRandomNamespaceBtn.addEventListener('click', () => {
      const namespace = generateRandomNamespace();
      randomNamespaceInput.value = namespace.base64;
      randomNamespaceInput.setAttribute('data-plaintext', namespace.plaintext);
      randomNamespaceInput.setAttribute('data-hex', namespace.hex);
      
      // Show namespace preview
      if (namespacePreview) {
        namespacePreview.classList.add('active');
        namespacePreviewHex.textContent = namespace.hex;
      }
    });
  }
  
  // Set up event listeners for automatic conversion between raw text and base64
  let isUpdating = false;
  
  if (rawTextInput) {
    rawTextInput.addEventListener('input', () => {
      if (isUpdating) return;
      isUpdating = true;
      
      const rawText = rawTextInput.value;
      if (rawText && base64Input) {
        base64Input.value = encodeToBase64(rawText);
      }
      
      isUpdating = false;
    });
  }
  
  if (base64Input) {
    base64Input.addEventListener('input', () => {
      if (isUpdating) return;
      isUpdating = true;
      
      const base64 = base64Input.value;
      if (base64 && isValidBase64(base64) && rawTextInput) {
        try {
          rawTextInput.value = decodeFromBase64(base64);
        } catch (error) {
          console.error('Error decoding base64:', error);
          // Leave raw text unchanged if decoding fails
        }
      }
      
      isUpdating = false;
    });
  }
  
  // Set up event listeners for encode/decode buttons
  if (encodeBtn) {
    encodeBtn.addEventListener('click', () => {
      const rawText = rawTextInput.value;
      if (rawText && base64Input) {
        base64Input.value = encodeToBase64(rawText);
      }
    });
  }
  
  if (decodeBtn) {
    decodeBtn.addEventListener('click', () => {
      const base64 = base64Input.value;
      if (base64 && isValidBase64(base64) && rawTextInput) {
        try {
          rawTextInput.value = decodeFromBase64(base64);
        } catch (error) {
          console.error('Error decoding base64:', error);
          showToast('Error decoding base64');
        }
      } else {
        showToast('Invalid base64 input');
      }
    });
  }
  
  // Set up event listener for blob submission form
  if (blobForm) {
    blobForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Hide previous results and errors
      if (resultContainer) resultContainer.style.display = 'none';
      if (errorMessage) errorMessage.style.display = 'none';
      
      // Show loading indicator
      if (loadingIndicator) loadingIndicator.style.display = 'block';
      
      try {
        // Get namespace based on selected type
        const selectedType = document.querySelector('input[name="namespaceType"]:checked').value;
        let namespace;
        
        switch (selectedType) {
          case 'base64':
            namespace = base64NamespaceInput.value.trim();
            break;
          case 'hex':
            // TODO: Implement hex namespace handling
            break;
          case 'plainText':
            namespace = createValidNamespace(plainTextNamespaceInput.value.trim()).base64;
            break;
          case 'random':
            namespace = randomNamespaceInput.value.trim();
            break;
          default:
            throw new Error('Invalid namespace type');
        }
        
        // Validate namespace
        const validation = validateNamespace(namespace);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }
        
        // Get blob data
        const blobData = blobDataInput.value.trim();
        if (!blobData) {
          throw new Error('Blob data is required');
        }
        
        // Submit blob
        const result = await submitBlob(namespace, blobData);
        
        // Update result container
        updateResultContainer(result);
      } catch (error) {
        console.error('Error submitting blob:', error);
        
        // Show error message
        if (errorMessage) {
          errorMessage.textContent = error.message;
          errorMessage.style.display = 'block';
        }
      } finally {
        // Hide loading indicator
        if (loadingIndicator) loadingIndicator.style.display = 'none';
      }
    });
  }
  
  // Set up event listener for blob retrieval form
  if (retrieveForm) {
    retrieveForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Hide previous results and errors
      if (blobResults) blobResults.style.display = 'none';
      if (retrieveErrorMessage) retrieveErrorMessage.style.display = 'none';
      
      // Show loading indicator
      if (retrieveLoadingIndicator) retrieveLoadingIndicator.style.display = 'block';
      
      try {
        // Get height and namespace
        const height = parseInt(retrieveHeight.value.trim());
        const namespaceInput = retrieveNamespace.value.trim();
        
        if (isNaN(height) || height <= 0) {
          throw new Error('Invalid height');
        }
        
        if (!namespaceInput) {
          throw new Error('Namespace is required');
        }
        
        // Determine if input is hex or base64
        let namespaceHex;
        if (/^[0-9A-Fa-f]+$/.test(namespaceInput)) {
          // Input is hex
          namespaceHex = namespaceInput.toUpperCase();
        } else if (isValidBase64(namespaceInput)) {
          // Input is base64
          namespaceHex = base64ToHex(namespaceInput);
        } else {
          throw new Error('Invalid namespace format (must be hex or base64)');
        }
        
        // Retrieve blob
        const result = await retrieveBlob(height, namespaceHex);
        
        // Show results
        if (blobResults) blobResults.style.display = 'block';
        
        // Display blob data
        if (blobDataContainer) {
          // Clear previous content
          blobDataContainer.innerHTML = '';
          
          if (result.data && result.data.length > 0) {
            result.data.forEach(blob => {
              const dataDisplay = formatBase64ForDisplay(blob.data);
              blobDataContainer.innerHTML += dataDisplay.html;
            });
          } else {
            blobDataContainer.innerHTML = '<div class="alert alert-info">No blob data found</div>';
          }
        }
        
        // Update command examples
        updateCommandExamples(height, namespaceHex, result.commitment);
      } catch (error) {
        console.error('Error retrieving blob:', error);
        
        // Show error message
        if (retrieveErrorMessage) {
          retrieveErrorMessage.textContent = error.message;
          retrieveErrorMessage.style.display = 'block';
        }
      } finally {
        // Hide loading indicator
        if (retrieveLoadingIndicator) retrieveLoadingIndicator.style.display = 'none';
      }
    });
  }
  
  // Add copy functionality for CLI command
  const copyCLICommand = document.getElementById('copyCLICommand');
  if (copyCLICommand) {
    copyCLICommand.addEventListener('click', () => {
      const command = document.getElementById('cliCommand').textContent;
      copyToClipboard(command);
    });
  }
  
  // Add copy functionality for curl command
  const copyCurlCommand = document.getElementById('copyCurlCommand');
  if (copyCurlCommand) {
    copyCurlCommand.addEventListener('click', () => {
      const command = document.getElementById('curlCommand').textContent;
      copyToClipboard(command);
    });
  }
}

/**
 * Submit a blob to the Celestia network
 * @param {string} namespace - Base64 encoded namespace
 * @param {string} data - Blob data (base64 encoded)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Submission result
 */
export async function submitBlob(namespace, data, options = {}) {
  try {
    // Convert namespace to hex if it's not already
    const namespaceHex = /^[0-9A-Fa-f]+$/.test(namespace) 
      ? namespace.toUpperCase() 
      : base64ToHex(namespace);
    
    // Prepare params
    const params = [
      [{ namespace: namespaceHex, data: data, share_version: 0 }],
      options
    ];
    
    // Send RPC request
    const response = await sendRpcRequest('blob.Submit', params);
    
    if (response.result) {
      return {
        height: response.result.height,
        hash: response.result.txhash,
        namespace: namespace,
        namespaceHex: namespaceHex,
        data: data
      };
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error submitting blob:', error);
    throw error;
  }
}

/**
 * Retrieve a blob by height and namespace
 * @param {number} height - Block height
 * @param {string} namespaceHex - Namespace in hex format
 * @returns {Promise<Object>} - Retrieved blob data
 */
export async function retrieveBlob(height, namespaceHex) {
  try {
    // Prepare params
    const params = [
      height,
      namespaceHex,
      { prove: true }
    ];
    
    // Send RPC request
    const response = await sendRpcRequest('blob.GetAll', params);
    
    if (response.result) {
      return {
        height: height,
        namespace: namespaceHex,
        commitment: response.result.commitment,
        data: response.result.blobs || []
      };
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error retrieving blob:', error);
    throw error;
  }
}

/**
 * Update the result container with successful submission details
 * @param {Object} result - Submission result
 */
function updateResultContainer(result) {
  const resultContainer = document.getElementById('resultContainer');
  const resultHeight = document.getElementById('resultHeight');
  const resultHash = document.getElementById('resultHash');
  const resultNamespace = document.getElementById('resultNamespace');
  
  if (!resultContainer) return;
  
  // Show result container
  resultContainer.style.display = 'block';
  
  // Update result details
  if (resultHeight) resultHeight.textContent = result.height;
  if (resultHash) resultHash.textContent = result.hash;
  if (resultNamespace) resultNamespace.textContent = result.namespaceHex;
  
  // Set up copy buttons
  const copyButtons = resultContainer.querySelectorAll('.copy-result');
  copyButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        copyToClipboard(targetElement.textContent.trim());
      }
    });
  });
}

/**
 * Update command examples with the correct values
 * @param {number} height - Block height
 * @param {string} namespaceHex - Namespace in hex format
 * @param {string} commitment - Commitment hash
 */
function updateCommandExamples(height, namespaceHex, commitment) {
  const cliCommand = document.getElementById('cliCommand');
  const curlCommand = document.getElementById('curlCommand');
  
  if (cliCommand) {
    cliCommand.textContent = `celestia blob get ${height} ${namespaceHex}`;
  }
  
  if (curlCommand) {
    curlCommand.textContent = `curl -X POST \\
  -H "Content-Type: application/json" \\
  --data '{"jsonrpc":"2.0","id":1,"method":"blob.GetAll","params":[${height},"${namespaceHex}",{"prove":true}]}' \\
  http://localhost:26658`;
  }
  
  // Update commitment display if available
  const commitmentDisplay = document.getElementById('commitmentDisplay');
  if (commitmentDisplay && commitment) {
    commitmentDisplay.textContent = commitment;
    commitmentDisplay.parentElement.style.display = 'block';
  } else if (commitmentDisplay) {
    commitmentDisplay.parentElement.style.display = 'none';
  }
}
