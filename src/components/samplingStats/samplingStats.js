import { sendRpcRequest } from '../../services/websocket.js';

// Sampling stats state
let samplingStats = null;
let realtimeStatsSource = null;

/**
 * Initialize the Sampling Stats tab
 */
export function initSamplingStatsTab() {
  // Get initial sampling stats
  getSamplingStats().catch(console.error);
  
  // Set up real-time stats
  setupRealtimeSamplingStats();
  
  // Set up refresh button
  const refreshStatsBtn = document.getElementById('refreshStatsBtn');
  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', () => {
      getSamplingStats().catch(console.error);
    });
  }
}

/**
 * Get DAS sampling stats
 * @returns {Promise<Object>} - The sampling stats
 */
export async function getSamplingStats() {
  try {
    const response = await sendRpcRequest('das.SamplingStats');
    
    if (response.result) {
      samplingStats = response.result;
      
      // Update UI
      updateSamplingStats(samplingStats);
      
      return samplingStats;
    } else {
      throw new Error('Invalid response from node');
    }
  } catch (error) {
    console.error('Error getting sampling stats:', error);
    
    // Update UI to show error
    const statsContainer = document.getElementById('samplingStatsContainer');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Error fetching sampling stats: ${error.message}
        </div>
      `;
    }
    
    throw error;
  }
}

/**
 * Set up real-time sampling stats updates using EventSource
 */
function setupRealtimeSamplingStats() {
  // Check if EventSource is supported
  if (typeof EventSource === 'undefined') {
    console.warn('EventSource is not supported in this browser. Real-time updates disabled.');
    return;
  }
  
  // Close any existing connection
  if (realtimeStatsSource) {
    realtimeStatsSource.close();
    realtimeStatsSource = null;
  }
  
  try {
    // Get the base URL from the WebSocket URL (replace ws:// with http://)
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/sampling-stats/stream`;
    
    realtimeStatsSource = new EventSource(url);
    
    realtimeStatsSource.onopen = () => {
      console.log('Real-time sampling stats connection established');
    };
    
    realtimeStatsSource.onmessage = (event) => {
      try {
        const stats = JSON.parse(event.data);
        updateSamplingStats(stats);
      } catch (error) {
        console.error('Error parsing real-time stats:', error);
      }
    };
    
    realtimeStatsSource.onerror = (error) => {
      console.error('Real-time sampling stats error:', error);
      
      // Close the connection on error
      realtimeStatsSource.close();
      realtimeStatsSource = null;
      
      // Try to reconnect after a delay
      setTimeout(() => {
        setupRealtimeSamplingStats();
      }, 5000);
    };
    
    // Set up cleanup when leaving the page
    window.addEventListener('beforeunload', () => {
      if (realtimeStatsSource) {
        realtimeStatsSource.close();
      }
    });
  } catch (error) {
    console.error('Error setting up real-time sampling stats:', error);
  }
}

/**
 * Update the sampling stats in the UI
 * @param {Object} stats - The sampling stats to display
 */
export function updateSamplingStats(stats) {
  const container = document.getElementById('samplingStatsContainer');
  if (!container) return;
  
  // Format the stats for display
  const formattedStats = formatSamplingStats(stats);
  
  // Update the UI
  container.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="mb-0">Sampling Overview</h5>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <span>Total Samples:</span>
              <span class="fw-bold">${formattedStats.totalSamples}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Sampling Rate:</span>
              <span class="fw-bold">${formattedStats.samplingRate}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Concurrent Samples:</span>
              <span class="fw-bold">${formattedStats.concurrentSamples}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Last Sampled Height:</span>
              <span class="fw-bold">${formattedStats.lastSampledHeight}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-md-6">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="mb-0">Performance Metrics</h5>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <span>Average Sample Time:</span>
              <span class="fw-bold">${formattedStats.avgSampleTime}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Samples Per Second:</span>
              <span class="fw-bold">${formattedStats.samplesPerSecond}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Cache Hit Rate:</span>
              <span class="fw-bold">${formattedStats.cacheHitRate}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Network Overhead:</span>
              <span class="fw-bold">${formattedStats.networkOverhead}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card mb-3">
      <div class="card-header">
        <h5 class="mb-0">Recent Sampling Activity</h5>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-striped table-hover mb-0">
            <thead>
              <tr>
                <th>Height</th>
                <th>Namespace</th>
                <th>Samples</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${formattedStats.recentActivity}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <div class="row">
      <div class="col-md-6">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="mb-0">Error Statistics</h5>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <span>Total Errors:</span>
              <span class="fw-bold">${formattedStats.totalErrors}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Error Rate:</span>
              <span class="fw-bold">${formattedStats.errorRate}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Most Common Error:</span>
              <span class="fw-bold">${formattedStats.mostCommonError}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-md-6">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="mb-0">Network Statistics</h5>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <span>Total Bytes Received:</span>
              <span class="fw-bold">${formattedStats.totalBytesReceived}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span>Average Response Size:</span>
              <span class="fw-bold">${formattedStats.avgResponseSize}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Peer Response Rate:</span>
              <span class="fw-bold">${formattedStats.peerResponseRate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="text-muted mt-3">
      <small>Last updated: ${formattedStats.lastUpdated}</small>
    </div>
  `;
}

/**
 * Format sampling stats for display
 * @param {Object} stats - The raw sampling stats
 * @returns {Object} - Formatted stats for display
 */
function formatSamplingStats(stats) {
  // Default values for when stats are missing
  const defaultStats = {
    totalSamples: 'N/A',
    samplingRate: 'N/A',
    concurrentSamples: 'N/A',
    lastSampledHeight: 'N/A',
    avgSampleTime: 'N/A',
    samplesPerSecond: 'N/A',
    cacheHitRate: 'N/A',
    networkOverhead: 'N/A',
    totalErrors: 'N/A',
    errorRate: 'N/A',
    mostCommonError: 'None',
    totalBytesReceived: 'N/A',
    avgResponseSize: 'N/A',
    peerResponseRate: 'N/A',
    recentActivity: '<tr><td colspan="5" class="text-center">No recent activity</td></tr>',
    lastUpdated: new Date().toLocaleString()
  };
  
  // Return default stats if no stats provided
  if (!stats) {
    return defaultStats;
  }
  
  // Format recent activity if available
  let recentActivity = defaultStats.recentActivity;
  if (stats.recent_samples && stats.recent_samples.length > 0) {
    recentActivity = stats.recent_samples.map(sample => {
      return `
        <tr>
          <td>${sample.height || 'N/A'}</td>
          <td>${formatNamespace(sample.namespace) || 'N/A'}</td>
          <td>${sample.count || 'N/A'}</td>
          <td>${formatDuration(sample.duration) || 'N/A'}</td>
          <td>${formatStatus(sample.status) || 'N/A'}</td>
        </tr>
      `;
    }).join('');
  }
  
  // Format cache hit rate if available
  let cacheHitRate = defaultStats.cacheHitRate;
  if (stats.cache_hits !== undefined && stats.cache_misses !== undefined) {
    const total = stats.cache_hits + stats.cache_misses;
    if (total > 0) {
      const rate = (stats.cache_hits / total) * 100;
      cacheHitRate = `${rate.toFixed(2)}%`;
    }
  }
  
  // Format error rate if available
  let errorRate = defaultStats.errorRate;
  if (stats.total_errors !== undefined && stats.total_samples !== undefined) {
    if (stats.total_samples > 0) {
      const rate = (stats.total_errors / stats.total_samples) * 100;
      errorRate = `${rate.toFixed(2)}%`;
    }
  }
  
  // Return formatted stats
  return {
    totalSamples: stats.total_samples !== undefined ? stats.total_samples.toLocaleString() : defaultStats.totalSamples,
    samplingRate: stats.sampling_rate !== undefined ? `${stats.sampling_rate.toFixed(2)} samples/block` : defaultStats.samplingRate,
    concurrentSamples: stats.concurrent_samples !== undefined ? stats.concurrent_samples : defaultStats.concurrentSamples,
    lastSampledHeight: stats.last_sampled_height !== undefined ? stats.last_sampled_height.toLocaleString() : defaultStats.lastSampledHeight,
    avgSampleTime: stats.avg_sample_time !== undefined ? formatDuration(stats.avg_sample_time) : defaultStats.avgSampleTime,
    samplesPerSecond: stats.samples_per_second !== undefined ? stats.samples_per_second.toFixed(2) : defaultStats.samplesPerSecond,
    cacheHitRate,
    networkOverhead: stats.network_overhead !== undefined ? formatBytes(stats.network_overhead) + '/s' : defaultStats.networkOverhead,
    totalErrors: stats.total_errors !== undefined ? stats.total_errors.toLocaleString() : defaultStats.totalErrors,
    errorRate,
    mostCommonError: stats.most_common_error || defaultStats.mostCommonError,
    totalBytesReceived: stats.total_bytes_received !== undefined ? formatBytes(stats.total_bytes_received) : defaultStats.totalBytesReceived,
    avgResponseSize: stats.avg_response_size !== undefined ? formatBytes(stats.avg_response_size) : defaultStats.avgResponseSize,
    peerResponseRate: stats.peer_response_rate !== undefined ? `${(stats.peer_response_rate * 100).toFixed(2)}%` : defaultStats.peerResponseRate,
    recentActivity,
    lastUpdated: new Date().toLocaleString()
  };
}

/**
 * Format a namespace for display
 * @param {string} namespace - The namespace to format
 * @returns {string} - Formatted namespace
 */
function formatNamespace(namespace) {
  if (!namespace) return 'N/A';
  
  // Truncate long namespaces
  if (namespace.length > 12) {
    return namespace.substring(0, 6) + '...' + namespace.substring(namespace.length - 6);
  }
  
  return namespace;
}

/**
 * Format a duration in milliseconds for display
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
  if (ms === undefined || ms === null) return 'N/A';
  
  if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else {
    return `${(ms / 1000).toFixed(2)} s`;
  }
}

/**
 * Format a status for display
 * @param {string} status - The status to format
 * @returns {string} - Formatted status with icon
 */
function formatStatus(status) {
  if (!status) return 'N/A';
  
  switch (status.toLowerCase()) {
    case 'success':
      return '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Success</span>';
    case 'error':
      return '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>Error</span>';
    case 'timeout':
      return '<span class="text-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>Timeout</span>';
    case 'in_progress':
      return '<span class="text-info"><i class="bi bi-arrow-repeat me-1"></i>In Progress</span>';
    default:
      return status;
  }
}

/**
 * Format bytes for display
 * @param {number} bytes - The number of bytes
 * @returns {string} - Formatted bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return 'N/A';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
