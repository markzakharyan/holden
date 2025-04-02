export interface User {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface Message {
  type: "success" | "error";
  text: string;
}