import { initTheme } from './utils/theme.js';
import { connectWebSocket } from './services/websocket.js';
import { setupTabNavigation } from './utils/navigation.js';
import { initNodeInfoTab } from './components/nodeInfo/nodeInfo.js';
import { initSamplingStatsTab } from './components/samplingStats/samplingStats.js';
import { initBlobPosterTab } from './components/blobPoster/blobPoster.js';
import { initDatabaseTab } from './components/database/database.js';

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
  initTheme();
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Set up tab navigation
  setupTabNavigation();
  
  // Initialize all tab components
  initNodeInfoTab();
  initSamplingStatsTab();
  initBlobPosterTab();
  initDatabaseTab();
});
