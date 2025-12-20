// Import CSS (Vite will process this)
import "../css/main.css";

// The existing modal.js and animation.js remain in web/
// They're loaded via <script type="module"> in the template
// because they use Three.js from the CDN importmap

// HMR support for development
if (import.meta.hot) {
  import.meta.hot.accept();
}
