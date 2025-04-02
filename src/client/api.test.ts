import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAuthState, uploadSchedule } from "./api";

// Mock fetch
vi.stubGlobal("fetch", vi.fn());

describe("API Functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchAuthState", () => {
    it("should return auth state when fetch is successful", async () => {
      const mockResponse = {
        isAuthenticated: true,
        user: {
          id: "123",
          email: "test@ucsb.edu",
          name: "Test User",
          accessToken: "token123",
          refreshToken: "refresh123",
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchAuthState();
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith("/api/user");
    });

    it("should return not authenticated when fetch fails", async () => {
      (fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchAuthState();
      expect(result).toEqual({ isAuthenticated: false, user: null });
      expect(fetch).toHaveBeenCalledWith("/api/user");
    });
  });

  describe("uploadSchedule", () => {
    it("should upload schedule successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Added 5 courses to your Google Calendar.",
        courses: ["CMPSC 16", "CMPSC 24", "CMPSC 32", "CMPSC 40", "CMPSC 48"],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const imageData = "data:image/png;base64,test123";
      const quarterEndDate = "2025-03-24";
      
      const result = await uploadSchedule(imageData, quarterEndDate);
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith("/api/upload-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData, quarterEndDate }),
      });
    });

    it("should throw error when upload fails", async () => {
      const errorResponse = {
        error: "Failed to process schedule",
        details: "Invalid image format",
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => errorResponse,
      });

      const imageData = "data:image/png;base64,test123";
      const quarterEndDate = "2025-03-24";
      
      await expect(uploadSchedule(imageData, quarterEndDate)).rejects.toThrow(
        "Failed to process schedule"
      );
    });
  });
});