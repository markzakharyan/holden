/**
 * Renders the login page
 * @returns HTML string for the login page
 */
export const renderLoginPage = (): string => {
  return `
    <div class="container" style="text-align: center; max-width: 1000px; margin-top: 2rem;">
      <h1>GOLD → GCal</h1>

      
      <div style="margin: 1.5rem 0;">
        <a href="/auth/google" class="login-button">
          Sign in with Google
        </a>
      </div>
      <!--
      <div style="margin-top: 1.5rem; color: #888;">
        <p>UCSB email required</p>
      </div>
      -->
    </div>
  `;
};