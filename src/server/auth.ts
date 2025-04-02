import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

// Configure Google Strategy for Passport
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: "/auth/google/callback",
      scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
    },
    (accessToken, refreshToken, profile, done) => {
      // Check if email is from UCSB (not required for now)
      const email = profile.emails?.[0]?.value;
      // if (!email || !email.endsWith("@ucsb.edu")) {
      //   return done(null, false, { message: "Only UCSB emails are allowed" });
      // }
      
      // Store tokens for later Google Calendar access
      const user = {
        id: profile.id,
        email,
        accessToken,
        refreshToken,
        name: profile.displayName,
      };
      
      return done(null, user);
    }
  )
);

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Auth middleware to check if user is authenticated
export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
};

// Check if user has UCSB email
export const isUcsbEmail = (email: string): boolean => {
  return email.endsWith("@ucsb.edu");
};

export default passport;