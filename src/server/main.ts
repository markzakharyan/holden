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
import { createClient } from "redis";
import { RedisStore } from "connect-redis";

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

// Set up session store based on environment
let sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || "default_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  }
};

// Use Redis store in production, but provide a fallback
if (process.env.NODE_ENV === "production") {
  // Check if we should disable Redis (for environments without Redis)
  const disableRedis = process.env.DISABLE_REDIS === "true";
  
  if (disableRedis) {
    console.log("Redis explicitly disabled, using memory session store (not recommended for production)");
  } else {
    try {
      // Initialize Redis client with limited retries
      const redisClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          reconnectStrategy: (retries) => {
            // Stop trying to reconnect after 5 attempts
            if (retries > 5) {
              console.log("Failed to connect to Redis after 5 attempts, using memory store");
              return false;
            }
            return Math.min(retries * 100, 3000); // Increasing delay between attempts
          }
        }
      });
      
      // Set up flag to prevent repeated error messages
      let errorLogged = false;
      redisClient.on('error', (err) => {
        if (!errorLogged) {
          console.error('Redis connection error:', err.message);
          console.log('Will use memory store instead (not recommended for production)');
          errorLogged = true;
        }
      });
      
      // Set a timeout for Redis connection
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
      });
      
      // Try to connect with timeout
      Promise.race([connectPromise, timeoutPromise])
        .then(() => {
          // Initialize Redis store
          sessionConfig.store = new RedisStore({ 
            client: redisClient,
            prefix: "goldcal:"
          });
          console.log("Successfully connected to Redis");
        })
        .catch(err => {
          console.log(`Redis connection failed: ${err.message}`);
          console.log("Using memory session store (not recommended for production)");
        });
    } catch (error) {
      console.error("Failed to initialize Redis store:", error);
      console.log("Falling back to memory store (not recommended for production)");
    }
  }
} else {
  console.log("Using memory session store for development");
}

// Session middleware
app.use(session(sessionConfig));

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


interface QuarterDates {
  startDate: Date;
  endDate: Date;
  quarterName: string;
}

function getQuarterDates(quarterType: "current" | "next"): QuarterDates {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  let startDate: Date;
  let quarterName: string;

  // Define approximate start months for each quarter (0-indexed)
  const fallStartMonth = 8; // September
  const winterStartMonth = 0; // January
  const springStartMonth = 3; // April
  const summerStartMonth = 5; // June

  // Determine current quarter start date
  if (quarterType === "current") {
    if (month >= fallStartMonth) {
      startDate = new Date(year, fallStartMonth, 20); // Approx Sept 20
      quarterName = "Fall";
    } else if (month >= summerStartMonth) {
      startDate = new Date(year, summerStartMonth, 20); // Approx June 20
      quarterName = "Summer";
    } else if (month >= springStartMonth) {
      startDate = new Date(year, springStartMonth, 1); // Approx April 1
      quarterName = "Spring";
    } else {
      startDate = new Date(year, winterStartMonth, 3); // Approx Jan 3
      quarterName = "Winter";
    }
  } else { // quarterType === "next"
    if (month >= fallStartMonth) { // Currently Fall, next is Winter of next year
      startDate = new Date(year + 1, winterStartMonth, 3);
      quarterName = "Winter";
    } else if (month >= summerStartMonth) { // Currently Summer, next is Fall
      startDate = new Date(year, fallStartMonth, 20);
      quarterName = "Fall";
    } else if (month >= springStartMonth) { // Currently Spring, next is Summer
      startDate = new Date(year, summerStartMonth, 20);
      quarterName = "Summer";
    } else { // Currently Winter, next is Spring
      startDate = new Date(year, springStartMonth, 1);
      quarterName = "Spring";
    }
  }

  // Calculate end date based on quarter type
  const endDate = new Date(startDate);
  const durationWeeks = (quarterName === "Summer") ? 6 : 10;
  endDate.setDate(startDate.getDate() + (durationWeeks * 7));

  return { startDate, endDate, quarterName };
}

// HTML schedule upload and processing
app.post("/api/upload-schedule", ensureAuth, upload.single('htmlFile'), async (req, res): Promise<void> => {
  try {
    const quarterType = req.body.quarterType as "current" | "next";
    
    if (!req.file || !quarterType) {
      res.status(400).json({ error: "Missing required HTML file or quarter type" });
      return;
    }

    // Get HTML content from uploaded file
    console.log("Received file:", req.file.originalname, "Size:", req.file.size, "bytes");
    console.log("MIME type:", req.file.mimetype);
    
    const htmlContent = req.file.buffer.toString('utf-8');
    console.log("Converted to string, length:", htmlContent.length);
    
    // Determine quarter start and end dates
    const { startDate, endDate, quarterName } = getQuarterDates(quarterType);
    console.log(`Using ${quarterName} Quarter: Start Date - ${startDate.toISOString()}, End Date - ${endDate.toISOString()}`);
    
    let courseSchedule;
    try {
      // Pass the start date to the HTML parser
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
      message: `Added ${eventIds.length} courses to your Google Calendar for ${quarterName} Quarter.`,
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
    const { htmlData, quarterType } = req.body;
    
    if (!htmlData || !quarterType) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    
    console.log("Processing schedule HTML from JSON payload, quarter type:", quarterType);
    const { startDate, endDate, quarterName } = getQuarterDates(quarterType);
    console.log(`Using ${quarterName} Quarter: Start Date - ${startDate.toISOString()}, End Date - ${endDate.toISOString()}`);
    
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
      message: `Added ${eventIds.length} courses to your Google Calendar for ${quarterName} Quarter.`,
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