import { AuthState } from "./types";

/**
 * Fetches the current user's authentication state
 * @returns The authentication state object
 */
export const fetchAuthState = async (): Promise<AuthState> => {
  try {
    const response = await fetch("/api/user");
    if (!response.ok) {
      throw new Error("Failed to fetch auth state");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching auth state:", error);
    return { isAuthenticated: false, user: null };
  }
};

/**
 * Uploads a schedule image to the server
 * @param imageData Base64 encoded image data
 * @param quarterEndDate Date string for the end of the quarter
 * @returns The response from the server
 */
export const uploadSchedule = async (
  imageData: string,
  quarterEndDate: string
): Promise<any> => {
  try {
    const response = await fetch("/api/upload-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageData, quarterEndDate }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload schedule");
    }
    
    return response.json();
  } catch (error) {
    console.error("Error uploading schedule:", error);
    throw error;
  }
};