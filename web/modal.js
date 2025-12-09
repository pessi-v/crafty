// Modal functions using Modal Component plugin with AJAX Twig rendering

// Store current modal state
let currentModalState = null;
let modalConfig = {};

// Initialize the modal system
export function initModal(config) {
  modalConfig = config;

  // Event delegation for dynamically loaded content
  document.getElementById('modal-inner').addEventListener('click', function(e) {
    // Handle recipe list item clicks
    const recipeItem = e.target.closest('.recipe-list-item');
    if (recipeItem) {
      const recipeId = recipeItem.getAttribute('data-recipe-id');
      if (recipeId) {
        showRecipeDetail(recipeId);
      }
      return;
    }

    // Handle back button clicks
    const backButton = e.target.closest('[data-action="back"]');
    if (backButton) {
      backToList();
      return;
    }
  });

  // Make functions available globally
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showRecipeDetail = showRecipeDetail;
  window.backToList = backToList;
}

// Get the modal dialog instance
function getModalDialog() {
  const modalElement = document.getElementById('recipe-modal');
  return modalElement ? modalElement._dialog : null;
}

// Fetch rendered Twig template via AJAX
async function fetchModalContent(params) {
  const url = new URL(modalConfig.ajaxUrl);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load modal content');
  }
  return await response.text();
}

// Modal functions
async function openModal(config) {
  // Prevent opening if modal is already open
  const dialog = getModalDialog();
  if (dialog && dialog.shown) {
    return;
  }

  // Store the config for back navigation
  currentModalState = {
    config: config,
    view: 'list'
  };

  // Display recipe list
  if (config.type === 'list') {
    await displayRecipeList(config);
  }

  // Show modal using plugin API
  if (dialog) {
    dialog.show();
  }
}

function closeModal() {
  const dialog = getModalDialog();
  if (dialog) {
    dialog.hide();
  }
  currentModalState = null;
}

async function displayRecipeList(config) {
  const modalInner = document.getElementById('modal-inner');

  try {
    // Fetch rendered Twig template using the view type from config
    const html = await fetchModalContent({
      view: config.view,
      listTitle: config.listTitle
    });

    modalInner.innerHTML = html;

    // Update modal state
    currentModalState.view = 'list';
  } catch (error) {
    console.error('Error loading recipe list:', error);
    modalInner.innerHTML = '<p>Error loading recipes. Please try again.</p>';
  }
}

async function showRecipeDetail(recipeId) {
  const modalInner = document.getElementById('modal-inner');

  // Show loading state
  modalInner.innerHTML = '<div style="text-align: center; padding: 40px;">Loading...</div>';

  try {
    // Fetch rendered Twig template
    const html = await fetchModalContent({
      view: 'detail',
      recipeId: recipeId,
      listTitle: currentModalState.config.listTitle
    });

    modalInner.innerHTML = html;

    // Scroll to top of modal
    const dialogContent = document.querySelector('#recipe-modal .dialog-content');
    if (dialogContent) {
      dialogContent.scrollTop = 0;
    }

    // Update modal state
    currentModalState.view = 'detail';
    currentModalState.currentRecipeId = recipeId;
  } catch (error) {
    console.error('Error loading recipe detail:', error);
    modalInner.innerHTML = '<p>Error loading recipe. Please try again.</p>';
  }
}

function backToList() {
  if (currentModalState && currentModalState.config) {
    displayRecipeList(currentModalState.config);
  }
}
