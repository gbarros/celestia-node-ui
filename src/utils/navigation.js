/**
 * Navigation utilities for tab switching
 */

/**
 * Set up tab navigation functionality
 */
export function setupTabNavigation() {
  // Get all tabs
  const tabs = document.querySelectorAll('#mainTabs .nav-link');
  
  // Set up click event for each tab
  tabs.forEach(tab => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      
      // Get the target tab ID
      const targetTabId = tab.getAttribute('href');
      
      // Deactivate all tabs
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      
      // Activate the clicked tab
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Hide all tab panes
      const tabPanes = document.querySelectorAll('.tab-pane');
      tabPanes.forEach(pane => {
        pane.classList.remove('show', 'active');
      });
      
      // Show the target tab pane
      const targetPane = document.querySelector(targetTabId);
      if (targetPane) {
        targetPane.classList.add('show', 'active');
      }
      
      // Save the active tab to localStorage
      localStorage.setItem('activeTab', targetTabId);
    });
  });
  
  // Restore active tab from localStorage if available
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    const tabToActivate = document.querySelector(`a[href="${savedTab}"]`);
    if (tabToActivate) {
      tabToActivate.click();
    }
  }
}
