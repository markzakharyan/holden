import express from "express";
import ViteExpress from "vite-express";
import session from "express-session";
import passport from "./auth";
import { ensureAuth } from "./auth";
import { addCoursesToCalendar, getCalendarEvent, listCalendarEvents } from "./calendar";
import { parseGoldHtml } from "./claude";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";

// Load environment variables
dotenv.config();

const app = express();

// Force HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.enable("trust proxy");
  app.use((req, res, next) => {
    if (!req.secure && req.get("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept HTML files and other text types (some browsers report HTML files as plain text)
    console.log("Uploaded file mimetype:", file.mimetype);
    if (file.mimetype === 'text/html' || 
        file.mimetype === 'text/plain' || 
        file.originalname.endsWith('.html') || 
        file.originalname.endsWith('.htm')) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  }
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.get("/api/user", (req, res): void => {
  if (req.isAuthenticated()) {
    res.json({ 
      isAuthenticated: true, 
      user: req.user 
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Authentication routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
    accessType: "offline",
    prompt: "consent",
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/",
  }),
  (_req, res): void => {
    res.redirect("/dashboard");
  }
);

app.get("/auth/logout", (req, res): void => {
  req.logout(() => {
    res.redirect("/");
  });
});

// HTML schedule upload and processing
app.post("/api/upload-schedule", ensureAuth, upload.single('htmlFile'), async (req, res): Promise<void> => {
  try {
    const quarterStartDate = req.body.quarterStartDate;
    
    if (!req.file || !quarterStartDate) {
      res.status(400).json({ error: "Missing required HTML file or quarter start date" });
      return;
    }

    // Get HTML content from uploaded file
    console.log("Received file:", req.file.originalname, "Size:", req.file.size, "bytes");
    console.log("MIME type:", req.file.mimetype);
    
    const htmlContent = req.file.buffer.toString('utf-8');
    console.log("Converted to string, length:", htmlContent.length);
    
    // Parse quarter start date and calculate end date (10 weeks later)
    const startDate = new Date(quarterStartDate);
    console.log("Quarter start date:", startDate.toISOString());
    
    // Calculate end date (10 weeks = 70 days after start)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 70); // 10 weeks * 7 days
    console.log("Calculated quarter end date:", endDate.toISOString());
    
    let courseSchedule;
    try {
      // Pass the start date to the HTML parser, NOT the end date
      courseSchedule = await parseGoldHtml(htmlContent, startDate);
      console.log("Successfully parsed schedule:", JSON.stringify(courseSchedule, null, 2));
    } catch (parseError) {
      console.error("Error during schedule parsing:", parseError);
      throw parseError;
    }
    
    // Add courses to Google Calendar
    const user = req.user as any; // Type assertion
    const eventIds = await addCoursesToCalendar(
      user.accessToken,
      user.refreshToken,
      courseSchedule
    );
    
    res.json({ 
      success: true, 
      message: `Added ${eventIds.length} courses to your Google Calendar.`,
      courses: courseSchedule.map(c => c.courseCode),
      eventIds: eventIds, // Return the event IDs for debugging
    });
  } catch (error) {
    console.error("Error processing schedule:", error);
    res.status(500).json({ 
      error: "Failed to process schedule", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Fallback endpoint for backward compatibility
app.post("/api/upload-schedule-legacy", ensureAuth, async (req, res): Promise<void> => {
  try {
    const { htmlData, quarterStartDate } = req.body;
    
    if (!htmlData || !quarterStartDate) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    
    console.log("Processing schedule HTML from JSON payload, quarter start date:", quarterStartDate);
    const startDate = new Date(quarterStartDate);
    
    // Calculate end date (10 weeks = 70 days after start)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 70); // 10 weeks * 7 days
    console.log("Calculated quarter end date:", endDate.toISOString());
    
    let courseSchedule;
    try {
      courseSchedule = await parseGoldHtml(htmlData, startDate);
      console.log("Successfully parsed schedule:", JSON.stringify(courseSchedule, null, 2));
    } catch (parseError) {
      console.error("Error during schedule parsing:", parseError);
      throw parseError;
    }
    
    // Add courses to Google Calendar
    const user = req.user as any; // Type assertion
    const eventIds = await addCoursesToCalendar(
      user.accessToken,
      user.refreshToken,
      courseSchedule
    );
    
    res.json({ 
      success: true, 
      message: `Added ${eventIds.length} courses to your Google Calendar.`,
      courses: courseSchedule.map(c => c.courseCode),
      eventIds: eventIds, // Return the event IDs for debugging
    });
  } catch (error) {
    console.error("Error processing schedule:", error);
    res.status(500).json({ 
      error: "Failed to process schedule", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Debug endpoint to check created events
app.get("/api/debug/event/:eventId", ensureAuth, async (req, res): Promise<void> => {
  try {
    const eventId = req.params.eventId;
    const user = req.user as any;
    
    const eventData = await getCalendarEvent(
      user.accessToken,
      user.refreshToken,
      eventId
    );
    
    res.json({ 
      success: true,
      event: eventData.data
    });
  } catch (error) {
    console.error("Error retrieving event:", error);
    res.status(500).json({ 
      error: "Failed to retrieve event", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Debug endpoint to list events in a date range
app.get("/api/debug/events", ensureAuth, async (req, res): Promise<void> => {
  try {
    const { timeMin, timeMax } = req.query;
    const user = req.user as any;
    
    // Default to current month if not provided
    const now = new Date();
    const defaultTimeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    
    const events = await listCalendarEvents(
      user.accessToken,
      user.refreshToken,
      (timeMin as string) || defaultTimeMin,
      (timeMax as string) || defaultTimeMax
    );
    
    res.json({ 
      success: true,
      events: events.data.items
    });
  } catch (error) {
    console.error("Error listing events:", error);
    res.status(500).json({ 
      error: "Failed to list events", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client")));
}

// Start server
ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000...")
);