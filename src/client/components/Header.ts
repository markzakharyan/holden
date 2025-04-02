import { AuthState } from "../types";

/**
 * Renders the application header
 * @param authState The current authentication state
 * @returns HTML string for the header
 */
export const renderHeader = (authState: AuthState): string => {
  const { isAuthenticated } = authState;
  
  return `
    <header class="header">
      <div class="container" style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1>HoldenBot</h1>
        </div>
        <div>
          ${isAuthenticated ? `<a href="/auth/logout" class="login-button">Logout</a>` : `<h1>by Mark</h1>`}
        </div>
      </div>
    </header>
  `;
};