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

// function closeModal() {
//   const dialog = getModalDialog();
//   if (dialog) {
//     isClosing = true;
//     console.log("WE GOT HERE");
//     dialog.hide();

//     // Add delay before allowing new modals to open (300ms)
//     setTimeout(() => {
//       isClosing = false;
//     }, 300);
//   }
//   currentModalState = null;
// }

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
    const doc = parser.parseFromString(html, 'text/html');
    const formContainer = doc.querySelector('.recipe-submit-container');

    if (formContainer) {
      modalInner.innerHTML = formContainer.outerHTML;

      // Re-attach event listeners for dynamic content blocks
      reattachFormListeners();
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

function reattachFormListeners() {
  let blockCounter = 0;

  const addTextBlockBtn = document.getElementById('add-text-block');
  const addImageBlockBtn = document.getElementById('add-image-block');

  if (addTextBlockBtn) {
    addTextBlockBtn.addEventListener('click', function() {
      blockCounter++;
      const container = document.getElementById('content-blocks');
      const blockDiv = document.createElement('div');
      blockDiv.className = 'content-block';
      blockDiv.style.cssText = 'margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; position: relative;';
      blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong>Text Block</strong>
          <button type="button" class="remove-block" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">Remove</button>
        </div>
        <input type="hidden" name="contentBlocks[${blockCounter}][type]" value="text">
        <textarea
          name="contentBlocks[${blockCounter}][text]"
          rows="4"
          style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
          placeholder="Enter text content..."
        ></textarea>
      `;
      container.appendChild(blockDiv);

      blockDiv.querySelector('.remove-block').addEventListener('click', function() {
        blockDiv.remove();
      });
    });
  }

  if (addImageBlockBtn) {
    addImageBlockBtn.addEventListener('click', function() {
      blockCounter++;
      const container = document.getElementById('content-blocks');
      const blockDiv = document.createElement('div');
      blockDiv.className = 'content-block';
      blockDiv.style.cssText = 'margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; position: relative;';
      blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong>Image Block</strong>
          <button type="button" class="remove-block" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">Remove</button>
        </div>
        <input type="hidden" name="contentBlocks[${blockCounter}][type]" value="image">
        <input
          type="file"
          name="contentBlocks[${blockCounter}][image]"
          accept="image/*"
          style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
        >
      `;
      container.appendChild(blockDiv);

      blockDiv.querySelector('.remove-block').addEventListener('click', function() {
        blockDiv.remove();
      });
    });
  }
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
