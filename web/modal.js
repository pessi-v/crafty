// Modal functions using Modal Component plugin with AJAX Twig rendering

// Store current modal state
let currentModalState = null;
let modalConfig = {};
let isClosing = false; // Flag to prevent immediate reopening after close
let isHandlingPopstate = false; // Flag to prevent infinite loops with history navigation
let modalHistoryDepth = 0; // Track how many history entries the modal has created
let modalOpenedViaBackButton = false; // Track if modal was restored via back navigation

// Initialize the modal system
export function initModal(config) {
  console.log("modal initiation");
  modalConfig = config;

  // Handle browser back/forward buttons
  window.addEventListener("popstate", function (e) {
    isHandlingPopstate = true;

    // Check if we just closed - don't restore if so
    const dialog = getModalDialog();

    if (e.state && e.state.modalConfig) {
      // Restore modal from history state
      modalOpenedViaBackButton = true; // Mark as restored via navigation
      restoreModalFromState(e.state);
    } else {
      // No modal state, close modal if open
      if (dialog && dialog.shown) {
        dialog.hide();
        modalHistoryDepth = 0; // Reset depth when fully closed
        modalOpenedViaBackButton = false;
      }
    }

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

// Modal functions
async function openModal(config) {
  // Prevent opening if modal is already open or closing
  const dialog = getModalDialog();
  if ((dialog && dialog.shown) || isClosing) {
    return;
  }

  // Reset history depth when opening a fresh modal
  modalHistoryDepth = 0;
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
  window.history.pushState(
    {
      modalConfig: config,
      modalView: "list",
      modalHistoryDepth: modalHistoryDepth
    },
    "",
    newURL
  );
}

function updateURLForRecipeDetail(recipeSlug) {
  const params = new URLSearchParams(window.location.search);
  params.set("recipe", recipeSlug);

  const newURL = `${window.location.pathname}?${params.toString()}`;
  modalHistoryDepth++;
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
  } else if (cravings === "all") {
    config = {
      type: "list",
      view: "all",
      listTitle: "All Recipes",
    };
  } else if (cravings === "categories") {
    config = {
      type: "list",
      view: "categories",
      listTitle: "All Categories",
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
