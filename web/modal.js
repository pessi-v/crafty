// Modal functions using Modal Component plugin with AJAX Twig rendering

// Store current modal state
let currentModalState = null;
let modalConfig = {};
let isClosing = false; // Flag to prevent immediate reopening after close

// Initialize the modal system
export function initModal(config) {
  console.log("modal initiation");
  modalConfig = config;

  // Event delegation for dynamically loaded content
  document
    .getElementById("modal-inner")
    .addEventListener("click", function (e) {
      // Handle category tag clicks
      const categoryTag = e.target.closest(".recipe-category-tag");
      if (categoryTag) {
        e.stopPropagation(); // Prevent triggering recipe item click
        const categorySlug = categoryTag.getAttribute("data-category-slug");
        if (categorySlug) {
          openCategoryModal(categorySlug);
        }
        return;
      }

      // Handle recipe list item clicks
      const recipeItem = e.target.closest(".recipe-list-item");
      if (recipeItem) {
        const recipeId = recipeItem.getAttribute("data-recipe-id");
        if (recipeId) {
          showRecipeDetail(recipeId);
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

  // Store the config for back navigation
  currentModalState = {
    config: config,
    view: "list",
  };

  // Display recipe list or form
  if (config.type === "list") {
    await displayRecipeList(config);
  } else if (config.type === "form") {
    await displayForm(config);
  }

  // Show modal using plugin API
  if (dialog) {
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

async function showRecipeDetail(recipeId) {
  const modalInner = document.getElementById("modal-inner");

  // Show loading state
  modalInner.innerHTML =
    '<div style="text-align: center; padding: 40px;">Loading...</div>';

  try {
    // Fetch rendered Twig template
    const html = await fetchModalContent({
      view: "detail",
      recipeId: recipeId,
      listTitle: currentModalState.config.listTitle,
    });

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
    currentModalState.currentRecipeId = recipeId;
  } catch (error) {
    console.error("Error loading recipe detail:", error);
    modalInner.innerHTML = "<p>Error loading recipe. Please try again.</p>";
  }
}

function backToList() {
  if (currentModalState && currentModalState.config) {
    displayRecipeList(currentModalState.config);
  }
}

// Open modal with category filter
async function openCategoryModal(categorySlug) {
  // Generate title from category slug (capitalize first letter)
  const title =
    categorySlug.charAt(0).toUpperCase() +
    categorySlug.slice(1) +
    " Recipes";

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
  } else {
    // Modal is closed, open it
    openModal(config);
  }
}
