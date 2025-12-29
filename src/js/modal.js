// Modal functions using Modal Component plugin with AJAX Twig rendering

// Store current modal state
let currentModalState = null;
let modalConfig = {};
let isClosing = false; // Flag to prevent immediate reopening after close
let isHandlingPopstate = false; // Flag to prevent infinite loops with history navigation
let modalHistoryDepth = 0; // Track how many history entries the modal has created
let modalOpenedViaBackButton = false; // Track if modal was restored via back navigation
let maxModalHistoryDepth = 0; // Track the maximum depth reached to detect forward history

// Initialize the modal system
export function initModal(config) {
  console.log("modal initiation");
  modalConfig = config;

  // Create and inject navigation buttons
  createNavigationButtons();

  // Handle browser back/forward buttons
  window.addEventListener("popstate", function (e) {
    isHandlingPopstate = true;

    // Check if we just closed - don't restore if so
    const dialog = getModalDialog();

    if (e.state && e.state.modalConfig) {
      // Update depth from state to track our position in history
      if (e.state.modalHistoryDepth !== undefined) {
        modalHistoryDepth = e.state.modalHistoryDepth;
      }

      // Restore modal from history state
      modalOpenedViaBackButton = true; // Mark as restored via navigation
      restoreModalFromState(e.state);
    } else {
      // No modal state, close modal if open
      if (dialog && dialog.shown) {
        dialog.hide();
        modalHistoryDepth = 0; // Reset depth when fully closed
        maxModalHistoryDepth = 0; // Reset max depth as well
        modalOpenedViaBackButton = false;
      }
    }

    // Update navigation button states
    updateNavigationButtons();

    // Reset flag after a short delay to allow hide event to complete
    setTimeout(() => {
      isHandlingPopstate = false;
    }, 100);
  });

  // Check URL on page load to restore modal state
  restoreModalFromURL();

  // Listen for modal close events to handle history
  const modalElement = document.getElementById("recipe-modal");
  if (modalElement) {
    // Use the plugin's built-in hide event
    modalElement.addEventListener("hide", function (event) {
      // Mark that we're closing to prevent any restoration attempts
      isClosing = true;

      // Only modify history if this is a user-initiated close (not from popstate)
      if (!isHandlingPopstate) {
        // ALWAYS just close and clean URL - no history navigation
        // This prevents loops and ensures modal always closes when user wants it to
        const cleanURL = window.location.pathname;
        window.history.replaceState({}, "", cleanURL);
        modalOpenedViaBackButton = false;
        modalHistoryDepth = 0;
        maxModalHistoryDepth = 0;
        updateNavigationButtons();
      }

      // Reset closing flag after modal is fully hidden
      setTimeout(() => {
        isClosing = false;
      }, 300);
    });
  }

  // Event delegation for dynamically loaded content
  document
    .getElementById("modal-inner")
    .addEventListener("click", function (e) {
      // Handle category tag and category card clicks
      const categoryElement = e.target.closest(
        ".recipe-categories__tag, .category-card"
      );
      if (categoryElement) {
        e.stopPropagation(); // Prevent triggering recipe item click
        const categorySlug = categoryElement.getAttribute("data-category-slug");
        if (categorySlug) {
          openCategoryModal(categorySlug);
        }
        return;
      }

      // Handle recipe list item clicks
      const recipeItem = e.target.closest(".recipe-list-item");
      if (recipeItem) {
        const recipeSlug = recipeItem.getAttribute("data-recipe-slug");
        const recipeId = recipeItem.getAttribute("data-recipe-id");
        if (recipeSlug) {
          showRecipeDetail(recipeId, recipeSlug);
        }
        return;
      }

      // Handle back button clicks
      const backButton = e.target.closest('[data-action="back"]');
      if (backButton) {
        console.log("modal backbutton");
        backToList();
        return;
      }
    });

  // !! MODAL CLOSING HANDLED BY MODAL PLUGIN
  // Close modal when clicking on the overlay (outside modal content)
  // const modalElement = document.getElementById("recipe-modal");
  // if (modalElement) {
  //   modalElement.addEventListener("click", function (e) {
  //     // Only close if clicking directly on the modal container (the overlay)
  //     if (e.target === modalElement) {
  //       console.log("close modal bc of overlay click");
  //       closeModal();
  //     }
  //   });
  // }

  // Make functions available globally
  window.openModal = openModal;
  // window.closeModal = closeModal; !! HANDLED BY MODAL PLUGIN
  window.showRecipeDetail = showRecipeDetail;
  window.backToList = backToList;
  window.isModalOpen = isModalOpen;
}

// Check if modal is currently open or in closing state
export function isModalOpen() {
  if (isClosing) {
    return true; // Treat as open during closing transition
  }
  const dialog = getModalDialog();
  return dialog && dialog.shown;
}

// Get the modal dialog instance
function getModalDialog() {
  const modalElement = document.getElementById("recipe-modal");
  return modalElement ? modalElement._dialog : null;
}

// Create and inject navigation buttons into the modal
function createNavigationButtons() {
  const modalElement = document.getElementById("recipe-modal");
  if (!modalElement) return;

  // Find the modal content container
  const modalContent = modalElement.querySelector(".snippets-modal__content");
  if (!modalContent) return;

  // Create navigation bar
  const navBar = document.createElement("div");
  navBar.id = "modal-nav-bar";
  navBar.className = "modal-nav-bar";
  navBar.innerHTML = `
    <button id="modal-nav-back" class="modal-nav-button" aria-label="Go back" disabled>
      <span class="modal-nav-button__icon">←</span>
      <span class="modal-nav-button__label">Back</span>
    </button>
    <button id="modal-nav-forward" class="modal-nav-button" aria-label="Go forward" disabled>
      <span class="modal-nav-button__label">Forward</span>
      <span class="modal-nav-button__icon">→</span>
    </button>
  `;

  // Insert navigation bar at the top of modal content
  modalContent.insertBefore(navBar, modalContent.firstChild);

  // Add event listeners
  document.getElementById("modal-nav-back").addEventListener("click", function () {
    if (!this.disabled) {
      window.history.back();
    }
  });

  document.getElementById("modal-nav-forward").addEventListener("click", function () {
    if (!this.disabled) {
      window.history.forward();
    }
  });
}

// Update navigation button states based on history
function updateNavigationButtons() {
  const backButton = document.getElementById("modal-nav-back");
  const forwardButton = document.getElementById("modal-nav-forward");

  if (!backButton || !forwardButton) return;

  // Back button: enabled if we have modal history depth > 0
  // This means we've navigated within the modal
  if (modalHistoryDepth > 0) {
    backButton.disabled = false;
  } else {
    backButton.disabled = true;
  }

  // Forward button: enabled if current depth < max depth
  // This means we've gone back and there's forward history available
  if (modalHistoryDepth < maxModalHistoryDepth) {
    forwardButton.disabled = false;
  } else {
    forwardButton.disabled = true;
  }
}

// Fetch rendered Twig template via AJAX
async function fetchModalContent(params) {
  const url = new URL(modalConfig.ajaxUrl);
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load modal content");
  }
  return await response.text();
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Perform recipe search via AJAX
async function performSearch(searchQuery) {
  const resultsContainer = document.getElementById('search-results-container');
  const loadingIndicator = document.querySelector('.modal-search__loading');

  if (!resultsContainer) return;

  // Show loading state
  if (loadingIndicator) {
    loadingIndicator.classList.remove('hidden');
  }

  try {
    // Fetch search results using existing fetchModalContent function
    const html = await fetchModalContent({
      view: 'search',
      searchQuery: searchQuery
    });

    resultsContainer.innerHTML = html;
  } catch (error) {
    console.error('Error performing search:', error);
    resultsContainer.innerHTML = '<p class="error">Error searching recipes. Please try again.</p>';
  } finally {
    // Hide loading state
    if (loadingIndicator) {
      loadingIndicator.classList.add('hidden');
    }
  }
}

// Create debounced search function (300ms delay)
const debouncedSearch = debounce(performSearch, 300);

// Initialize search input listener
function initSearchInput() {
  const searchInput = document.getElementById('recipe-search-input');
  const clearButton = document.getElementById('search-clear-button');
  const allRecipesSection = document.getElementById('all-recipes-section');

  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();

    // Toggle clear button visibility
    if (clearButton) {
      clearButton.classList.toggle('hidden', !query);
    }

    // Clear results if query is empty
    if (!query) {
      const resultsContainer = document.getElementById('search-results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
      }
      // Show all recipes section when search is cleared
      if (allRecipesSection) {
        allRecipesSection.classList.remove('hidden');
      }
      return;
    }

    // Hide all recipes section when searching
    if (allRecipesSection) {
      allRecipesSection.classList.add('hidden');
    }

    // Perform debounced search
    debouncedSearch(query);
  });

  // Clear button handler
  if (clearButton) {
    clearButton.addEventListener('click', function() {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });
  }

  // Handle Enter key to prevent form submission behavior
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });
}

// Modal functions
async function openModal(config) {
  // Prevent opening if modal is already open or closing
  const dialog = getModalDialog();
  if ((dialog && dialog.shown) || isClosing) {
    return;
  }

  // Reset history depth when opening a fresh modal
  modalHistoryDepth = 0;
  maxModalHistoryDepth = 0;
  modalOpenedViaBackButton = false; // This is a fresh open, not via back button

  // Store the config for back navigation
  currentModalState = {
    config: config,
    view: "list",
  };

  // Update URL with modal state
  updateURLForModal(config);

  // Display recipe list or form
  if (config.type === "list") {
    await displayRecipeList(config);
  } else if (config.type === "form") {
    await displayForm(config);
  }

  // Show modal using plugin API
  // Double-check we're not in closing state before showing
  if (dialog && !isClosing) {
    console.log("opening modal!");
    dialog.show();
    updateNavigationButtons();
  }
}

async function displayRecipeList(config) {
  const modalInner = document.getElementById("modal-inner");

  try {
    // Fetch rendered Twig template using the view type from config
    const html = await fetchModalContent({
      view: config.view,
      listTitle: config.listTitle,
    });

    modalInner.innerHTML = html;

    // Update modal state
    currentModalState.view = "list";

    // Initialize search input if present
    initSearchInput();
  } catch (error) {
    console.error("Error loading recipe list:", error);
    modalInner.innerHTML = "<p>Error loading recipes. Please try again.</p>";
  }
}

async function displayForm(config) {
  const modalInner = document.getElementById("modal-inner");

  try {
    // Fetch the form page content
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error("Failed to load form");
    }
    const html = await response.text();

    // Extract just the form content (not the full page)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const formContainer = doc.querySelector("#recipe-submit-container");

    if (formContainer) {
      modalInner.innerHTML = formContainer.outerHTML;

      // Attach form submission handler
      attachFormSubmissionHandler();
    } else {
      modalInner.innerHTML = html; // Fallback to full content
    }

    // Update modal state
    currentModalState.view = "form";
  } catch (error) {
    console.error("Error loading form:", error);
    modalInner.innerHTML = "<p>Error loading form. Please try again.</p>";
  }
}

// Handle form submission via AJAX
function attachFormSubmissionHandler() {
  const form = document.getElementById("recipe-form");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form data
    const formData = new FormData(form);

    // Show loading state on submit button
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
      // Submit form via AJAX
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      // Remove any existing messages
      const existingNotice = form.querySelector(".notice");
      const existingError = form.querySelector(".error");
      if (existingNotice) existingNotice.remove();
      if (existingError) existingError.remove();

      if (result.success) {
        // Show success message
        const successMessage = document.createElement("div");
        successMessage.className = "notice";
        successMessage.textContent = result.message;
        form.insertBefore(successMessage, form.firstChild);

        // Clear form fields
        form.reset();

        // Scroll to top of modal to show message
        const dialogContent = document.querySelector(
          "#recipe-modal .snippets-modal__content"
        );
        if (dialogContent) {
          dialogContent.scrollTop = 0;
        }
      } else {
        // Show error message
        const errorMessage = document.createElement("div");
        errorMessage.className = "error";
        errorMessage.textContent =
          result.error || "An error occurred. Please try again.";
        form.insertBefore(errorMessage, form.firstChild);

        // Scroll to top of modal to show message
        const dialogContent = document.querySelector(
          "#recipe-modal .snippets-modal__content"
        );
        if (dialogContent) {
          dialogContent.scrollTop = 0;
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);

      // Show error message
      const existingError = form.querySelector(".error");
      if (existingError) existingError.remove();

      const errorMessage = document.createElement("div");
      errorMessage.className = "error";
      errorMessage.textContent = "An error occurred. Please try again.";
      form.insertBefore(errorMessage, form.firstChild);
    } finally {
      // Restore submit button
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });
}

async function showRecipeDetail(recipeId, recipeSlug) {
  const modalInner = document.getElementById("modal-inner");

  try {
    // Fetch rendered Twig template
    const html = await fetchModalContent({
      view: "detail",
      recipeId: recipeId,
      listTitle: currentModalState.config.listTitle,
    });

    modalInner.innerHTML = html;

    // Update modal state
    currentModalState.view = "detail";
    currentModalState.currentRecipeId = recipeId;
    currentModalState.currentRecipeSlug = recipeSlug;

    // Update URL for recipe detail using slug
    updateURLForRecipeDetail(recipeSlug);
  } catch (error) {
    console.error("Error loading recipe detail:", error);
    modalInner.innerHTML = "<p>Error loading recipe. Please try again.</p>";
  }
}

function backToList() {
  // Use browser's back button instead of manually updating
  // This ensures proper integration with browser navigation
  window.history.back();
}

// Show recipe detail by slug (for URL restoration)
async function showRecipeDetailBySlug(recipeSlug) {
  const modalInner = document.getElementById("modal-inner");

  try {
    // Fetch rendered Twig template using slug
    const params = {
      view: "detail",
      recipeSlug: recipeSlug,
    };

    // Only include listTitle if there's a config context
    if (currentModalState.config && currentModalState.config.listTitle) {
      params.listTitle = currentModalState.config.listTitle;
    }

    const html = await fetchModalContent(params);

    modalInner.innerHTML = html;

    // Scroll to top of modal
    const dialogContent = document.querySelector(
      "#recipe-modal .dialog-content"
    );
    if (dialogContent) {
      dialogContent.scrollTop = 0;
    }

    // Update modal state
    currentModalState.view = "detail";
    currentModalState.currentRecipeSlug = recipeSlug;
  } catch (error) {
    console.error("Error loading recipe detail:", error);
    modalInner.innerHTML = "<p>Error loading recipe. Please try again.</p>";
  }
}

// Open modal with category filter
async function openCategoryModal(categorySlug) {
  // Generate title from category slug (capitalize first letter)
  const title =
    categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1) + " Recipes";

  const config = {
    type: "list",
    view: categorySlug, // Pass slug directly - server handles mapping
    listTitle: title,
  };

  // Check if modal is already open
  const dialog = getModalDialog();
  if (dialog && dialog.shown) {
    // Modal is already open, just update the content
    currentModalState = {
      config: config,
      view: "list",
    };
    await displayRecipeList(config);
    // Update URL for category filter
    updateURLForModal(config);
  } else {
    // Modal is closed, open it
    openModal(config);
  }
}

// URL management functions
function resetURL() {
  // Reset to base URL without query parameters
  modalHistoryDepth = 0;
  window.history.pushState({}, "", window.location.pathname);
}

function updateURLForModal(config) {
  const params = new URLSearchParams();

  if (config.type === "list") {
    params.set("cravings", config.view);
  } else if (config.type === "form") {
    params.set("cravings", "submit");
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;
  modalHistoryDepth++;

  // Update max depth when we push new history (going forward)
  if (modalHistoryDepth > maxModalHistoryDepth) {
    maxModalHistoryDepth = modalHistoryDepth;
  }

  window.history.pushState(
    {
      modalConfig: config,
      modalView: "list",
      modalHistoryDepth: modalHistoryDepth
    },
    "",
    newURL
  );
  updateNavigationButtons();
}

function updateURLForRecipeDetail(recipeSlug) {
  const params = new URLSearchParams(window.location.search);
  params.set("recipe", recipeSlug);

  const newURL = `${window.location.pathname}?${params.toString()}`;
  modalHistoryDepth++;

  // Update max depth when we push new history (going forward)
  if (modalHistoryDepth > maxModalHistoryDepth) {
    maxModalHistoryDepth = modalHistoryDepth;
  }

  window.history.pushState(
    {
      modalConfig: currentModalState.config,
      modalView: "detail",
      recipeSlug: recipeSlug,
      modalHistoryDepth: modalHistoryDepth
    },
    "",
    newURL
  );
  updateNavigationButtons();
}

async function restoreModalFromState(state) {
  const dialog = getModalDialog();

  if (state.modalView === "detail" && state.recipeSlug) {
    // Restore recipe detail view
    currentModalState = {
      config: state.modalConfig,
      view: "detail",
      currentRecipeSlug: state.recipeSlug,
    };

    if (!dialog.shown && !isClosing) {
      await displayRecipeList(state.modalConfig);
      if (!isClosing) {
        dialog.show();
      }
    }
    if (!isClosing) {
      await showRecipeDetailBySlug(state.recipeSlug);
    }
  } else if (state.modalConfig) {
    // Restore list or form view
    currentModalState = {
      config: state.modalConfig,
      view: state.modalConfig.type === "form" ? "form" : "list",
    };

    if (dialog && dialog.shown) {
      // Modal is already open, just update the content
      if (state.modalConfig.type === "list") {
        await displayRecipeList(state.modalConfig);
      } else if (state.modalConfig.type === "form") {
        await displayForm(state.modalConfig);
      }
    } else {
      // Modal is closed, open it
      await openModal(state.modalConfig);
    }
  }
}

async function restoreModalFromURL() {
  const params = new URLSearchParams(window.location.search);
  const cravings = params.get("cravings");
  const recipeSlug = params.get("recipe");

  if (!cravings && !recipeSlug) return;

  // Reset depth when restoring from URL (no history entries created yet)
  modalHistoryDepth = 0;
  maxModalHistoryDepth = 0;
  modalOpenedViaBackButton = false; // Initial page load, not via back button

  // If only recipe slug is provided (no cravings context)
  if (recipeSlug && !cravings) {
    currentModalState = {
      config: null, // No back button context
      view: "detail",
      currentRecipeSlug: recipeSlug,
    };

    const dialog = getModalDialog();
    if (!isClosing) {
      await showRecipeDetailBySlug(recipeSlug);
      if (!isClosing) {
        dialog.show();
      }
    }
    return;
  }

  // Build config based on URL parameters
  let config;

  if (cravings === "submit") {
    config = {
      type: "form",
      url: modalConfig.ajaxUrl.replace("/ajax-modal", "/submit"),
      listTitle: "Submit a Recipe",
    };
  } else if (cravings === "hamburger") {
    config = {
      type: "list",
      view: "hamburger",
      listTitle: "Browse Recipes",
    };
  } else {
    // Assume it's a category slug
    config = {
      type: "list",
      view: cravings,
      listTitle:
        cravings.charAt(0).toUpperCase() + cravings.slice(1) + " Recipes",
    };
  }

  // Open the modal
  currentModalState = {
    config: config,
    view: recipeSlug ? "detail" : "list",
  };

  const dialog = getModalDialog();

  if (!isClosing) {
    if (config.type === "list") {
      await displayRecipeList(config);
    } else if (config.type === "form") {
      await displayForm(config);
    }

    if (!isClosing) {
      dialog.show();
    }

    // If there's a recipe slug, show the detail view
    if (recipeSlug && !isClosing) {
      await showRecipeDetailBySlug(recipeSlug);
    }
  }
}
