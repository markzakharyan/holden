import "./style.css";
import { fetchAuthState } from "./api";
import { renderHeader } from "./components/Header";
import { renderLoginPage } from "./components/Login";
import { renderDashboard, setupDashboardEvents } from "./components/Dashboard";
import { AuthState } from "./types";

/**
 * Initializes the application
 */
const initApp = async (): Promise<void> => {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  
  // Fetch authentication state
  const authState: AuthState = await fetchAuthState();
  
  // Render the app based on authentication state
  app.innerHTML = `
    <main>
      ${renderHeader(authState)}
      ${authState.isAuthenticated ? renderDashboard(authState) : renderLoginPage()}
    </main>
  `;
  
  // Set up event handlers after the DOM is updated
  if (authState.isAuthenticated) {
    setupDashboardEvents();
  }
};

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);