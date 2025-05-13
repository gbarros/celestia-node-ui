import { sendRpcRequest, getConnectionStatus } from '../../services/websocket.js';
import { showToast, copyToClipboard } from '../../utils/common.js';

// Node info state
let nodeAddress = null;
let nodeBalance = null;
let nodeP2PInfo = null;

/**
 * Initialize the Node Info tab
 */
export function initNodeInfoTab() {
  // Update node info when tab is loaded
  updateAllNodeInfo();
  
  // Set up refresh button
  const refreshNodeInfoBtn = document.getElementById('refreshNodeInfoBtn');
  if (refreshNodeInfoBtn) {
    refreshNodeInfoBtn.addEventListener('click', () => {
      updateAllNodeInfo();
    });
  }
  
  // Set up copy buttons
  setupCopyButtons();
  
  // Set up transfer form
  setupTransferForm();
}

/**
 * Set up copy buttons for node info
 */
function setupCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-node-info');
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
 * Set up transfer form for sending TIA
 */
function setupTransferForm() {
  const transferForm = document.getElementById('transferForm');
  const transferSuccess = document.getElementById('transferSuccess');
  
  if (transferForm) {
    transferForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const recipientAddress = document.getElementById('recipientAddress').value.trim();
      const amountInput = document.getElementById('transferAmount').value.trim();
      const amount = parseFloat(amountInput);
      
      if (!recipientAddress) {
        showToast('Please enter a recipient address');
        return;
      }
      
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount');
        return;
      }
      
      // Disable form during submission
      const submitButton = transferForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
      
      try {
        const result = await transferTIA(recipientAddress, amount);
        
        // Show success message
        if (transferSuccess) {
          transferSuccess.style.display = 'block';
          transferSuccess.querySelector('#txHash').textContent = result.hash;
          transferSuccess.querySelector('#txHeight').textContent = result.height;
        }
        
        // Clear form
        transferForm.reset();
        
        // Refresh balance after transfer
        setTimeout(() => {
          refreshNodeBalance();
        }, 5000); // Wait 5 seconds for the transaction to be processed
      } catch (error) {
        console.error('Error transferring TIA:', error);
        showToast('Error: ' + error.message);
      } finally {
        // Re-enable form
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
      }
    });
  }
  
  // Set up copy tx hash button
  const copyTxHashBtn = document.getElementById('copyTxHash');
  if (copyTxHashBtn) {
    copyTxHashBtn.addEventListener('click', () => {
      const txHash = document.getElementById('txHash');
      if (txHash) {
        copyToClipboard(txHash.textContent.trim());
      }
    });
  }
}

/**
 * Get the node's account address
 * @returns {Promise<string>} - The node's account address
 */
export async function getNodeAddress() {
  try {
    const response = await sendRpcRequest('header.NodeAddress');
    
    if (response.result && response.result.address) {
      nodeAddress = response.result.address;
      
      // Update UI
      const addressElement = document.getElementById('nodeAddress');
      if (addressElement) {
        addressElement.textContent = nodeAddress;
      }
      
      return nodeAddress;
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error getting node address:', error);
    
    // Update UI to show error
    const addressElement = document.getElementById('nodeAddress');
    if (addressElement) {
      addressElement.textContent = 'Error: Unable to get node address';
    }
    
    throw error;
  }
}

/**
 * Get the node's P2P info
 * @returns {Promise<Object>} - The node's P2P info
 */
export async function getNodeP2PInfo() {
  try {
    const response = await sendRpcRequest('p2p.Info');
    
    if (response.result) {
      nodeP2PInfo = response.result;
      
      // Update UI
      const p2pInfoElement = document.getElementById('nodeP2PInfo');
      const p2pDetailsElement = document.getElementById('nodeP2PDetails');
      
      if (p2pInfoElement) {
        p2pInfoElement.textContent = nodeP2PInfo.id || 'N/A';
      }
      
      if (p2pDetailsElement) {
        // Format the details nicely
        const details = [];
        if (nodeP2PInfo.peers) {
          details.push(`Connected peers: ${nodeP2PInfo.peers.length}`);
        }
        if (nodeP2PInfo.listeners) {
          details.push(`Listeners: ${nodeP2PInfo.listeners.join(', ')}`);
        }
        
        p2pDetailsElement.textContent = details.join(' | ');
      }
      
      return nodeP2PInfo;
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error getting node P2P info:', error);
    
    // Update UI to show error
    const p2pInfoElement = document.getElementById('nodeP2PInfo');
    const p2pDetailsElement = document.getElementById('nodeP2PDetails');
    
    if (p2pInfoElement) {
      p2pInfoElement.textContent = 'Error: Unable to get P2P info';
    }
    
    if (p2pDetailsElement) {
      p2pDetailsElement.textContent = '';
    }
    
    throw error;
  }
}

/**
 * Get the node's account balance
 * @returns {Promise<Object>} - The node's balance info
 */
export async function getNodeBalance() {
  try {
    const response = await sendRpcRequest('state.Balance');
    
    if (response.result) {
      nodeBalance = response.result;
      
      // Update UI
      const balanceElement = document.getElementById('nodeBalance');
      const balanceUtiaElement = document.getElementById('nodeBalanceUtia');
      
      if (balanceElement) {
        // Convert utia to TIA (1 TIA = 1,000,000 utia)
        const balanceTIA = parseInt(nodeBalance.amount) / 1000000;
        balanceElement.textContent = balanceTIA.toFixed(6) + ' TIA';
      }
      
      if (balanceUtiaElement) {
        balanceUtiaElement.textContent = nodeBalance.amount + ' utia';
      }
      
      return nodeBalance;
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error getting node balance:', error);
    
    // Update UI to show error
    const balanceElement = document.getElementById('nodeBalance');
    const balanceUtiaElement = document.getElementById('nodeBalanceUtia');
    
    if (balanceElement) {
      balanceElement.textContent = 'Error: Unable to get balance';
    }
    
    if (balanceUtiaElement) {
      balanceUtiaElement.textContent = '';
    }
    
    throw error;
  }
}

/**
 * Refresh the node's balance
 */
export async function refreshNodeBalance() {
  try {
    await getNodeBalance();
  } catch (error) {
    console.error('Error refreshing node balance:', error);
  }
}

/**
 * Update all node information
 */
export function updateAllNodeInfo() {
  // Check if connected
  if (!getConnectionStatus()) {
    // Update UI to show disconnected state
    const elements = [
      { id: 'nodeAddress', text: 'Not connected to node' },
      { id: 'nodeBalance', text: 'Not connected to node' },
      { id: 'nodeBalanceUtia', text: '' },
      { id: 'nodeP2PInfo', text: 'Not connected to node' },
      { id: 'nodeP2PDetails', text: '' }
    ];
    
    elements.forEach(({ id, text }) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = text;
      }
    });
    
    return;
  }
  
  // Update all node info
  getNodeAddress().catch(console.error);
  getNodeBalance().catch(console.error);
  getNodeP2PInfo().catch(console.error);
}

/**
 * Transfer TIA to another address
 * @param {string} recipientAddress - The recipient's address
 * @param {number} amountInTIA - The amount to transfer in TIA
 * @param {number} gasAdjustment - Gas adjustment factor (default: 1.3)
 * @param {number} maxGasPrice - Maximum gas price in TIA (default: 0.002)
 * @returns {Promise<Object>} - Transaction result
 */
export async function transferTIA(recipientAddress, amountInTIA, gasAdjustment = 1.3, maxGasPrice = 0.002) {
  try {
    // Convert TIA to utia (1 TIA = 1,000,000 utia)
    const amountInUtia = Math.floor(amountInTIA * 1000000).toString();
    
    // Convert gas price to utia
    const maxGasPriceUtia = Math.floor(maxGasPrice * 1000000).toString();
    
    const response = await sendRpcRequest('state.Transfer', [
      recipientAddress,
      amountInUtia,
      {
        gasAdjustment: gasAdjustment.toString(),
        maxGasPrice: maxGasPriceUtia
      }
    ]);
    
    if (response.result) {
      return {
        hash: response.result.hash,
        height: response.result.height,
        ...response.result
      };
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error transferring TIA:', error);
    throw error;
  }
}
