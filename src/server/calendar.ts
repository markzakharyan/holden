import { google } from "googleapis";

/**
 * Creates Google Calendar events for a user's schedule
 * @param accessToken User's Google OAuth access token
 * @param refreshToken User's Google OAuth refresh token  
 * @param courseSchedule Array of course objects with course info
 */
/**
 * Lists calendar events within a date range for debugging
 */
export const listCalendarEvents = async (
  accessToken: string,
  refreshToken: string,
  timeMin: string,
  timeMax: string
): Promise<any> => {
  try {
    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "/auth/google/callback"
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Create calendar client
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    // List events
    return await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime"
    });
  } catch (error) {
    console.error("Error listing calendar events:", error);
    throw error;
  }
};

/**
 * Retrieves an event from Google Calendar for debugging
 */
export const getCalendarEvent = async (
  accessToken: string,
  refreshToken: string,
  eventId: string
): Promise<any> => {
  try {
    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "/auth/google/callback"
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Create calendar client
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    // Get the event
    return await calendar.events.get({
      calendarId: "primary",
      eventId: eventId
    });
  } catch (error) {
    console.error("Error getting calendar event:", error);
    throw error;
  }
};

export const addCoursesToCalendar = async (
  accessToken: string,
  refreshToken: string,
  courseSchedule: CourseEvent[]
): Promise<string[]> => {
  try {
    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "/auth/google/callback"
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Create calendar client
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    // Results array to track created events
    const createdEventIds: string[] = [];

    // Create calendar events for each course
    for (const course of courseSchedule) {
      // Ensure days are in the correct format (MO, TU, WE, TH, FR)
      const validDays = course.days.map(day => normalizeDay(day));
      
      // Calculate course dates based on the quarter start date
      // Map from RFC5545 day code to JavaScript day number (0-6)
      const dayCodeToNumber: {[key: string]: number} = {
        "SU": 0, "MO": 1, "TU": 2, "WE": 3, "TH": 4, "FR": 5, "SA": 6
      };
      
      // Get first day from course.days
      if (course.days.length === 0) {
        console.warn(`Course ${course.courseCode} has no days specified, defaulting to Monday`);
        course.days = ["MO"]; // Default to Monday if no days specified
      }
      
      // Use the first day in the course's schedule
      const firstDay = course.days[0];
      const targetDayNum = dayCodeToNumber[firstDay];
      
      // Get the quarter start date (We're using the quarterEndDate field 
      // which is now actually storing the start date)
      // IMPORTANT: Create a fresh copy to avoid modifying the original date
      const quarterStart = new Date(course.quarterEndDate.getTime());
      console.log(`Raw quarter start date: ${quarterStart.toISOString()}`);
      const startDay = quarterStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate days to add to the quarter start to get to the first class
      let daysToAdd = (targetDayNum - startDay + 7) % 7;
      // If the class is on the same day as quarter start, don't add days
      if (daysToAdd === 0 && targetDayNum === startDay) {
        daysToAdd = 0;
      }
      
      // Create date for the first class of the quarter
      const firstClassDate = new Date(quarterStart);
      firstClassDate.setDate(quarterStart.getDate() + daysToAdd);
      
      // Create new dates for the class times
      const startTime = new Date(course.startTime);
      const endTime = new Date(course.endTime);
      
      // Clean up the course code for display in calendar
      const cleanCourseCode = course.courseCode.replace(/\s+/g, ' ').trim();
      
      // Set date part to the first class date while keeping the time part
      startTime.setFullYear(firstClassDate.getFullYear());
      startTime.setMonth(firstClassDate.getMonth());
      startTime.setDate(firstClassDate.getDate());
      
      endTime.setFullYear(firstClassDate.getFullYear());
      endTime.setMonth(firstClassDate.getMonth());
      endTime.setDate(firstClassDate.getDate());
      
      console.log(`Scheduled ${cleanCourseCode} for ${firstDay}, first class on ${startTime.toISOString()}`);
      
      // Calculate end date (10 weeks = 70 days after quarter start)
      const quarterEnd = new Date(quarterStart);
      quarterEnd.setDate(quarterStart.getDate() + 70);
      console.log(`Quarter end date set to ${quarterEnd.toISOString()}`);
      
      const event = {
        summary: cleanCourseCode,
        location: course.location,
        description: `${course.courseTitle}\nInstructor: ${course.instructor}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/Los_Angeles",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/Los_Angeles",
        },
        recurrence: [
          `RRULE:FREQ=WEEKLY;UNTIL=${formatDate(quarterEnd)};BYDAY=${validDays.join(",")}`,
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
          ],
        },
        visibility: "public", // Ensure visibility is set to public
      };

      // Log the event data for debugging
      console.log(`Creating calendar event:
        Course: ${event.summary}
        Days: ${validDays.join(",")}
        Start: ${event.start.dateTime}
        End: ${event.end.dateTime}
        Recurrence: ${event.recurrence[0]}
      `);
      
      // Insert event to calendar
      const result = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      console.log(`Calendar API response: 
        Status: ${result.status}
        Event ID: ${result.data.id}
        HTML Link: ${result.data.htmlLink}
      `);

      if (result.data.id) {
        createdEventIds.push(result.data.id);
      }
    }

    return createdEventIds;
  } catch (error) {
    console.error("Error adding courses to calendar:", error);
    throw error;
  }
};

/**
 * Formats date for RRULE format (YYYYMMDDTHHMMSSZ)
 */
const formatDate = (date: Date): string => {
  // Format as YYYYMMDDTHHMMSSZ (RFC5545 format)
  // Make sure the date is in UTC for consistency
  const utcDate = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ));
  
  // Format according to RFC5545
  return utcDate.toISOString().replace(/[-:]/g, "").replace(/\.\d+/g, "");
};

/**
 * Normalizes day abbreviations to RFC5545 format
 * Ensures days are in two-letter format: MO, TU, WE, TH, FR
 */
const normalizeDay = (day: string): string => {
  const dayMap: Record<string, string> = {
    // Handle possible abbreviated forms
    "M": "MO",
    "T": "TU",
    "W": "WE",
    "R": "TH", // UCSB sometimes uses R for Thursday
    "F": "FR",
    
    // Handle full day names (case insensitive)
    "MONDAY": "MO",
    "TUESDAY": "TU",
    "WEDNESDAY": "WE",
    "THURSDAY": "TH",
    "FRIDAY": "FR",
    
    // Handle 3-letter abbreviations
    "MON": "MO",
    "TUE": "TU",
    "WED": "WE",
    "THU": "TH",
    "FRI": "FR"
  };
  
  // Normalize to uppercase for matching
  const normalizedDay = day.toUpperCase();
  
  // Return the mapped value or the original if it's already correct
  return dayMap[normalizedDay] || (day.length === 2 ? day : "MO"); // Default to MO if we can't map it
};

export interface CourseEvent {
  courseCode: string;
  courseTitle: string;
  instructor: string;
  location: string;
  days: string[]; // "MO", "TU", "WE", "TH", "FR"
  startTime: Date;
  endTime: Date;
  quarterEndDate: Date;
}