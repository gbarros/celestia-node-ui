import { sendRpcRequest } from '../../services/websocket.js';
import { 
  showToast, 
  copyToClipboard, 
  createValidNamespace, 
  validateNamespace,
  base64ToHex
} from '../../utils/common.js';

// LocalStorage keys
const DB_NAMESPACE_KEY = 'celestia_db_namespace';
const DB_TOKEN_KEY = 'celestia_db_token';
const DB_SCHEMA_KEY = 'celestia_db_schema';

/**
 * Initialize the Database tab
 */
export function initDatabaseTab() {
  // Set up initialization form
  setupInitDbForm();
  
  // Set up record form
  setupAddRecordForm();
  
  // Set up refresh button
  const refreshDbBtn = document.getElementById('refreshDbBtn');
  if (refreshDbBtn) {
    refreshDbBtn.addEventListener('click', () => {
      displayDatabaseRecords();
    });
  }
  
  // Check if database is already initialized
  updateDatabaseInfoPanel();
}

/**
 * Set up the database initialization form
 */
function setupInitDbForm() {
  const initDbForm = document.getElementById('initDbForm');
  const dbNamespace = document.getElementById('dbNamespace');
  const generateDbNamespaceBtn = document.getElementById('generateDbNamespace');
  const schemaTextarea = document.getElementById('dbSchema');
  const schemaPreview = document.getElementById('schemaPreview');
  const schemaPreviewContent = document.getElementById('schemaPreviewContent');
  const initDbBtn = document.getElementById('initDbBtn');
  const initDbLoading = document.getElementById('initDbLoading');
  
  // Generate a random namespace for the database
  if (generateDbNamespaceBtn) {
    generateDbNamespaceBtn.addEventListener('click', () => {
      const namespace = createValidNamespace('db-' + Math.random().toString(36).substring(2, 8));
      dbNamespace.value = namespace.base64;
    });
  }
  
  // Show schema preview when schema is entered
  if (schemaTextarea) {
    schemaTextarea.addEventListener('input', () => {
      try {
        const schema = JSON.parse(schemaTextarea.value);
        schemaPreviewContent.textContent = JSON.stringify(schema, null, 2);
        schemaPreview.style.display = 'block';
      } catch (error) {
        schemaPreview.style.display = 'none';
      }
    });
  }
  
  // Initialize database on form submit
  if (initDbForm) {
    initDbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const namespace = dbNamespace.value.trim();
      let schema;
      
      try {
        schema = JSON.parse(schemaTextarea.value);
      } catch (error) {
        showToast('Invalid JSON schema');
        return;
      }
      
      // Validate namespace
      const validation = validateNamespace(namespace);
      if (!validation.isValid) {
        showToast('Invalid namespace: ' + validation.error);
        return;
      }
      
      // Show loading indicator
      initDbBtn.disabled = true;
      initDbLoading.style.display = 'block';
      
      try {
        await initializeDatabase(namespace, schema);
        
        // Show success message
        showToast('Database initialized successfully');
        
        // Update UI
        updateDatabaseInfoPanel();
        displayDatabaseSchema();
        
        // Hide initialization form
        const initSection = document.getElementById('initDbSection');
        if (initSection) {
          initSection.style.display = 'none';
        }
        
        // Show schema view section
        const schemaViewSection = document.getElementById('schemaViewSection');
        if (schemaViewSection) {
          schemaViewSection.style.display = 'block';
        }
      } catch (error) {
        console.error('Error initializing database:', error);
        showToast('Error: ' + error.message);
      } finally {
        // Hide loading indicator
        initDbBtn.disabled = false;
        initDbLoading.style.display = 'none';
      }
    });
  }
}

/**
 * Set up the add record form
 */
function setupAddRecordForm() {
  const addRecordForm = document.getElementById('addRecordForm');
  const recordData = document.getElementById('recordData');
  const addRecordBtn = document.getElementById('addRecordBtn');
  const addRecordLoading = document.getElementById('addRecordLoading');
  
  // Add record on form submit
  if (addRecordForm) {
    addRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let data;
      try {
        data = JSON.parse(recordData.value);
      } catch (error) {
        showToast('Invalid JSON data');
        return;
      }
      
      // Show loading indicator
      addRecordBtn.disabled = true;
      addRecordLoading.style.display = 'block';
      
      try {
        // Validate data against schema
        const schema = await retrieveDatabaseSchema();
        const validation = validateDataAgainstSchema(data, schema);
        
        if (!validation.isValid) {
          throw new Error('Validation error: ' + validation.error);
        }
        
        // Add record
        await addDatabaseRecord(data);
        
        // Show success message
        showToast('Record added successfully');
        
        // Clear form
        recordData.value = '';
        
        // Refresh records
        displayDatabaseRecords();
      } catch (error) {
        console.error('Error adding record:', error);
        showToast('Error: ' + error.message);
      } finally {
        // Hide loading indicator
        addRecordBtn.disabled = false;
        addRecordLoading.style.display = 'none';
      }
    });
  }
}

/**
 * Generate a secure random token for encryption
 * @returns {string} - Random token
 */
function generateAuthToken() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the current auth token or generate a new one
 * @returns {string} - Auth token
 */
function getOrCreateAuthToken() {
  let token = localStorage.getItem(DB_TOKEN_KEY);
  if (!token) {
    token = generateAuthToken();
    localStorage.setItem(DB_TOKEN_KEY, token);
  }
  return token;
}

/**
 * Simple encryption function using AES-GCM
 * @param {Object} data - Data to encrypt
 * @param {string} token - Encryption token
 * @returns {Promise<string>} - Encrypted data as base64
 */
async function encryptData(data, token) {
  try {
    // Convert data to JSON string
    const jsonString = JSON.stringify(data);
    
    // Convert token to key
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(token),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('celestia-db-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encoder.encode(jsonString)
    );
    
    // Combine IV and encrypted content
    const result = new Uint8Array(iv.length + encryptedContent.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedContent), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode.apply(null, result));
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw error;
  }
}

/**
 * Simple decryption function using AES-GCM
 * @param {string} encryptedBase64 - Encrypted data as base64
 * @param {string} token - Decryption token
 * @returns {Promise<Object>} - Decrypted data
 */
async function decryptData(encryptedBase64, token) {
  try {
    // Convert base64 to array
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes)
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);
    
    // Convert token to key
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(token),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('celestia-db-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt data
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      ciphertext
    );
    
    // Convert to JSON
    const jsonString = new TextDecoder().decode(decryptedContent);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw error;
  }
}

/**
 * Clear database cache
 */
function clearDatabaseCache() {
  localStorage.removeItem(DB_NAMESPACE_KEY);
  localStorage.removeItem(DB_SCHEMA_KEY);
  
  // Don't remove the token, as it's needed to decrypt existing data
  // localStorage.removeItem(DB_TOKEN_KEY);
  
  // Update UI
  updateDatabaseInfoPanel();
}

/**
 * Initialize a new database
 * @param {string} namespace - Base64 encoded namespace
 * @param {Object} schema - Database schema
 * @returns {Promise<Object>} - Initialization result
 */
async function initializeDatabase(namespace, schema) {
  try {
    // Get auth token
    const token = getOrCreateAuthToken();
    
    // Encrypt schema
    const encryptedSchema = await encryptData(schema, token);
    
    // Convert namespace to hex if it's not already
    const namespaceHex = /^[0-9A-Fa-f]+$/.test(namespace) 
      ? namespace.toUpperCase() 
      : base64ToHex(namespace);
    
    // Create metadata blob
    const metadata = {
      type: 'celestia-db',
      version: '1.0.0',
      created: new Date().toISOString(),
      schema: encryptedSchema
    };
    
    // Submit metadata blob
    const params = [
      [{ namespace: namespaceHex, data: btoa(JSON.stringify(metadata)), share_version: 0 }],
      {}
    ];
    
    const response = await sendRpcRequest('blob.Submit', params);
    
    if (response.result) {
      // Save namespace and schema to localStorage
      localStorage.setItem(DB_NAMESPACE_KEY, namespace);
      localStorage.setItem(DB_SCHEMA_KEY, JSON.stringify(schema));
      
      return {
        height: response.result.height,
        hash: response.result.txhash,
        namespace: namespace,
        namespaceHex: namespaceHex
      };
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Add a record to the database
 * @param {Object} data - Record data
 * @returns {Promise<Object>} - Submission result
 */
async function addDatabaseRecord(data) {
  try {
    // Get namespace and token
    const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
    const token = getOrCreateAuthToken();
    
    if (!namespace) {
      throw new Error('Database not initialized');
    }
    
    // Encrypt data
    const encryptedData = await encryptData(data, token);
    
    // Convert namespace to hex if it's not already
    const namespaceHex = /^[0-9A-Fa-f]+$/.test(namespace) 
      ? namespace.toUpperCase() 
      : base64ToHex(namespace);
    
    // Create record blob
    const record = {
      type: 'celestia-db-record',
      version: '1.0.0',
      created: new Date().toISOString(),
      data: encryptedData
    };
    
    // Submit record blob
    const params = [
      [{ namespace: namespaceHex, data: btoa(JSON.stringify(record)), share_version: 0 }],
      {}
    ];
    
    const response = await sendRpcRequest('blob.Submit', params);
    
    if (response.result) {
      return {
        height: response.result.height,
        hash: response.result.txhash,
        namespace: namespace,
        namespaceHex: namespaceHex
      };
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error adding record:', error);
    throw error;
  }
}

/**
 * Validate data against the database schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Database schema
 * @returns {Object} - Validation result
 */
function validateDataAgainstSchema(data, schema) {
  try {
    // Simple schema validation
    for (const field in schema.fields) {
      const fieldSchema = schema.fields[field];
      
      // Check required fields
      if (fieldSchema.required && (data[field] === undefined || data[field] === null)) {
        return {
          isValid: false,
          error: `Field '${field}' is required`
        };
      }
      
      // Skip validation for undefined optional fields
      if (data[field] === undefined) {
        continue;
      }
      
      // Check type
      if (fieldSchema.type) {
        const valueType = typeof data[field];
        
        if (fieldSchema.type === 'string' && valueType !== 'string') {
          return {
            isValid: false,
            error: `Field '${field}' must be a string`
          };
        } else if (fieldSchema.type === 'number' && valueType !== 'number') {
          return {
            isValid: false,
            error: `Field '${field}' must be a number`
          };
        } else if (fieldSchema.type === 'boolean' && valueType !== 'boolean') {
          return {
            isValid: false,
            error: `Field '${field}' must be a boolean`
          };
        } else if (fieldSchema.type === 'object' && (valueType !== 'object' || Array.isArray(data[field]))) {
          return {
            isValid: false,
            error: `Field '${field}' must be an object`
          };
        } else if (fieldSchema.type === 'array' && !Array.isArray(data[field])) {
          return {
            isValid: false,
            error: `Field '${field}' must be an array`
          };
        }
      }
    }
    
    return {
      isValid: true,
      error: null
    };
  } catch (error) {
    console.error('Error validating data against schema:', error);
    return {
      isValid: false,
      error: 'Error validating data: ' + error.message
    };
  }
}

/**
 * Retrieve database schema
 * @returns {Promise<Object>} - Database schema
 */
async function retrieveDatabaseSchema() {
  try {
    // First check localStorage
    const cachedSchema = localStorage.getItem(DB_SCHEMA_KEY);
    if (cachedSchema) {
      return JSON.parse(cachedSchema);
    }
    
    // Get namespace
    const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
    if (!namespace) {
      throw new Error('Database not initialized');
    }
    
    // Convert namespace to hex if it's not already
    const namespaceHex = /^[0-9A-Fa-f]+$/.test(namespace) 
      ? namespace.toUpperCase() 
      : base64ToHex(namespace);
    
    // Retrieve all blobs for this namespace
    const response = await sendRpcRequest('blob.GetAll', [0, namespaceHex, { prove: false }]);
    
    if (!response.result || !response.result.blobs || response.result.blobs.length === 0) {
      throw new Error('No database metadata found');
    }
    
    // Find metadata blob
    let metadata = null;
    for (const blob of response.result.blobs) {
      try {
        const data = JSON.parse(atob(blob.data));
        if (data.type === 'celestia-db') {
          metadata = data;
          break;
        }
      } catch (error) {
        console.error('Error parsing blob data:', error);
      }
    }
    
    if (!metadata) {
      throw new Error('No database metadata found');
    }
    
    // Decrypt schema
    const token = getOrCreateAuthToken();
    const schema = await decryptData(metadata.schema, token);
    
    // Cache schema
    localStorage.setItem(DB_SCHEMA_KEY, JSON.stringify(schema));
    
    return schema;
  } catch (error) {
    console.error('Error retrieving database schema:', error);
    throw error;
  }
}

/**
 * Retrieve database records
 * @returns {Promise<Array>} - Database records
 */
async function retrieveDatabaseRecords() {
  try {
    // Get namespace
    const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
    if (!namespace) {
      throw new Error('Database not initialized');
    }
    
    // Convert namespace to hex if it's not already
    const namespaceHex = /^[0-9A-Fa-f]+$/.test(namespace) 
      ? namespace.toUpperCase() 
      : base64ToHex(namespace);
    
    // Get token
    const token = getOrCreateAuthToken();
    
    // Retrieve all blobs for this namespace
    const response = await sendRpcRequest('blob.GetAll', [0, namespaceHex, { prove: false }]);
    
    if (!response.result || !response.result.blobs) {
      throw new Error('Error retrieving database records');
    }
    
    // Process blobs
    const records = [];
    for (const blob of response.result.blobs) {
      try {
        const blobData = JSON.parse(atob(blob.data));
        
        // Skip metadata blobs
        if (blobData.type === 'celestia-db') {
          continue;
        }
        
        // Process record blobs
        if (blobData.type === 'celestia-db-record') {
          const decryptedData = await decryptData(blobData.data, token);
          records.push({
            data: decryptedData,
            created: blobData.created,
            height: blob.height
          });
        }
      } catch (error) {
        console.error('Error processing blob:', error);
      }
    }
    
    // Sort records by creation time (newest first)
    records.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return records;
  } catch (error) {
    console.error('Error retrieving database records:', error);
    throw error;
  }
}

/**
 * Display database records in the table
 */
async function displayDatabaseRecords() {
  const recordsTable = document.getElementById('recordsTable');
  const recordsTableBody = document.getElementById('recordsTableBody');
  const recordsLoading = document.getElementById('recordsLoading');
  const recordsError = document.getElementById('recordsError');
  
  if (!recordsTable || !recordsTableBody) return;
  
  // Show loading indicator
  if (recordsLoading) recordsLoading.style.display = 'block';
  if (recordsError) recordsError.style.display = 'none';
  
  try {
    // Check if database is initialized
    const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
    if (!namespace) {
      throw new Error('Database not initialized');
    }
    
    // Get schema to determine table columns
    const schema = await retrieveDatabaseSchema();
    
    // Get records
    const records = await retrieveDatabaseRecords();
    
    // Clear table
    recordsTableBody.innerHTML = '';
    
    // Update table header
    const headerRow = recordsTable.querySelector('thead tr');
    if (headerRow) {
      // Start with timestamp and height columns
      headerRow.innerHTML = '<th>Timestamp</th><th>Height</th>';
      
      // Add columns for each field in the schema
      for (const field in schema.fields) {
        headerRow.innerHTML += `<th>${field}</th>`;
      }
    }
    
    // Add records to table
    if (records.length === 0) {
      recordsTableBody.innerHTML = `
        <tr>
          <td colspan="${2 + Object.keys(schema.fields).length}" class="text-center">No records found</td>
        </tr>
      `;
    } else {
      for (const record of records) {
        const row = document.createElement('tr');
        
        // Add timestamp
        const timestampCell = document.createElement('td');
        timestampCell.textContent = new Date(record.created).toLocaleString();
        row.appendChild(timestampCell);
        
        // Add height
        const heightCell = document.createElement('td');
        heightCell.textContent = record.height;
        row.appendChild(heightCell);
        
        // Add data fields
        for (const field in schema.fields) {
          const cell = document.createElement('td');
          
          if (record.data[field] !== undefined) {
            // Format based on type
            if (typeof record.data[field] === 'object') {
              cell.innerHTML = `<pre class="mb-0">${JSON.stringify(record.data[field], null, 2)}</pre>`;
            } else {
              cell.textContent = record.data[field];
            }
          } else {
            cell.textContent = '-';
          }
          
          row.appendChild(cell);
        }
        
        recordsTableBody.appendChild(row);
      }
    }
    
    // Show table
    recordsTable.style.display = 'table';
  } catch (error) {
    console.error('Error displaying database records:', error);
    
    // Show error message
    if (recordsError) {
      recordsError.textContent = error.message;
      recordsError.style.display = 'block';
    }
    
    // Hide table
    recordsTable.style.display = 'none';
  } finally {
    // Hide loading indicator
    if (recordsLoading) recordsLoading.style.display = 'none';
  }
}

/**
 * Display the schema in the UI
 */
async function displayDatabaseSchema() {
  const schemaContainer = document.getElementById('schemaContainer');
  const schemaLoading = document.getElementById('schemaLoading');
  const schemaError = document.getElementById('schemaError');
  
  if (!schemaContainer) return;
  
  // Show loading indicator
  if (schemaLoading) schemaLoading.style.display = 'block';
  if (schemaError) schemaError.style.display = 'none';
  
  try {
    // Get schema
    const schema = await retrieveDatabaseSchema();
    
    // Display schema
    schemaContainer.innerHTML = `
      <pre class="mb-0">${JSON.stringify(schema, null, 2)}</pre>
    `;
    
    // Show schema container
    schemaContainer.style.display = 'block';
    
    // Update record form with schema fields
    updateRecordFormWithSchema(schema);
  } catch (error) {
    console.error('Error displaying schema:', error);
    
    // Show error message
    if (schemaError) {
      schemaError.textContent = error.message;
      schemaError.style.display = 'block';
    }
    
    // Hide schema container
    schemaContainer.style.display = 'none';
  } finally {
    // Hide loading indicator
    if (schemaLoading) schemaLoading.style.display = 'none';
  }
}

/**
 * Update the record form with schema fields
 * @param {Object} schema - Database schema
 */
function updateRecordFormWithSchema(schema) {
  const recordData = document.getElementById('recordData');
  if (!recordData) return;
  
  // Create a template object based on the schema
  const template = {};
  for (const field in schema.fields) {
    const fieldSchema = schema.fields[field];
    
    // Set default values based on type
    if (fieldSchema.type === 'string') {
      template[field] = '';
    } else if (fieldSchema.type === 'number') {
      template[field] = 0;
    } else if (fieldSchema.type === 'boolean') {
      template[field] = false;
    } else if (fieldSchema.type === 'object') {
      template[field] = {};
    } else if (fieldSchema.type === 'array') {
      template[field] = [];
    } else {
      template[field] = null;
    }
  }
  
  // Set template as value
  recordData.value = JSON.stringify(template, null, 2);
}

/**
 * Update the database info panel
 */
function updateDatabaseInfoPanel() {
  const dbInfoPanel = document.getElementById('dbInfoPanel');
  const dbNamespaceDisplay = document.getElementById('dbNamespaceDisplay');
  const dbSchemaBtn = document.getElementById('viewDbSchemaBtn');
  const dbRecordsBtn = document.getElementById('viewDbRecordsBtn');
  const dbInitSection = document.getElementById('initDbSection');
  const dbOperationsSection = document.getElementById('dbOperationsSection');
  
  // Get namespace
  const namespace = localStorage.getItem(DB_NAMESPACE_KEY);
  
  if (namespace) {
    // Database is initialized
    if (dbNamespaceDisplay) {
      dbNamespaceDisplay.textContent = namespace;
    }
    
    // Show operations section
    if (dbOperationsSection) {
      dbOperationsSection.style.display = 'block';
    }
    
    // Hide init section
    if (dbInitSection) {
      dbInitSection.style.display = 'none';
    }
    
    // Show info panel
    if (dbInfoPanel) {
      dbInfoPanel.style.display = 'block';
    }
    
    // Set up schema button
    if (dbSchemaBtn) {
      dbSchemaBtn.addEventListener('click', () => {
        displayDatabaseSchema();
      });
    }
    
    // Set up records button
    if (dbRecordsBtn) {
      dbRecordsBtn.addEventListener('click', () => {
        displayDatabaseRecords();
      });
    }
    
    // Display schema and records
    displayDatabaseSchema();
    displayDatabaseRecords();
  } else {
    // Database is not initialized
    
    // Hide operations section
    if (dbOperationsSection) {
      dbOperationsSection.style.display = 'none';
    }
    
    // Show init section
    if (dbInitSection) {
      dbInitSection.style.display = 'block';
    }
    
    // Hide info panel
    if (dbInfoPanel) {
      dbInfoPanel.style.display = 'none';
    }
  }
}
