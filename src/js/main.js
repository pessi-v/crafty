// Import CSS (Vite will process this)
import "../css/main.css";

// Import modal functionality
import { initModal } from "./modal.js";

// Make initModal available globally for the template
window.initModal = initModal;

// The existing animation.js remains in web/
// It's loaded via <script type="module"> in the template
// because it uses Three.js from the CDN importmap

// HMR support for development
if (import.meta.hot) {
  import.meta.hot.accept();
}
