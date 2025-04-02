import * as cheerio from 'cheerio';
import { CourseEvent } from "./calendar";

/**
 * Parses GOLD HTML schedule into structured course data
 * @param htmlContent HTML content of the GOLD schedule page
 * @param quarterStartDate Start date of the quarter
 * @returns Structured course event objects
 */
export const parseGoldHtml = async (
  htmlContent: string,
  quarterStartDate: Date
): Promise<CourseEvent[]> => {
  try {
    console.log('HTML content length:', htmlContent.length);
    console.log('Sample of HTML:', htmlContent.substring(0, 500) + '...');

    if (!htmlContent || htmlContent.trim() === '') {
      throw new Error('Empty HTML content provided');
    }

    console.log('Attempting to load HTML with cheerio...');
    
    const $ = cheerio.load(htmlContent);
    console.log('Cheerio loaded successfully');
    
    // Analyze HTML structure
    console.log('Document title:', $('title').text());
    console.log('All divs count:', $('div').length);
    
    // Look for key elements
    const possibleSelectors = [
      '.scheduleItem', 
      '[class*="schedule"]', 
      '[id*="schedule"]',
      '[class*="course"]',
      '[id*="course"]',
      '.datatableNew',
      '#div_Schedule_Container'
    ];
    
    possibleSelectors.forEach(selector => {
      const count = $(selector).length;
      console.log(`Elements matching "${selector}": ${count}`);
      
      if (count > 0 && count < 10) {
        console.log(`First element text for "${selector}":`, $(selector).first().text().substring(0, 100) + '...');
      }
    });
    
    const courseEvents: CourseEvent[] = [];
    
    console.log('Looking for schedule items...');
    let scheduleItems = $('.scheduleItem');
    
    // If no schedule items found, try alternative selectors
    if (scheduleItems.length === 0) {
      console.log('No .scheduleItem elements found, trying alternative selectors...');
      
      // Try to find the course elements another way
      if ($('[id*="CourseHeadingLabel"]').length > 0) {
        console.log('Found elements with CourseHeadingLabel');
        scheduleItems = $('[id*="CourseHeadingLabel"]').closest('.row').closest('.row').closest('.scheduleItem') as any;
      }
      
      // If still not found, look for div containing course information
      if (scheduleItems.length === 0 && $('#div_Schedule_Container').length > 0) {
        console.log('Trying to parse from #div_Schedule_Container');
        scheduleItems = $('#div_Schedule_Container').find('div').filter((_, el) => {
          return $(el).find('[id*="CourseHeadingLabel"]').length > 0;
        }) as any;
      }
    }
    
    console.log(`Found ${scheduleItems.length} schedule items`);
    
    // Find all schedule items
    scheduleItems.each((_, element) => {
      console.log('Processing schedule item...');
      // Skip the total units section
      if ($(element).hasClass('unitsSection')) {
        console.log('Skipping units section');
        return;
      }
      
      // Get course code and title
      const courseHeadingElem = $(element).find('.courseHeadingLabel, [id*=CourseHeadingLabel], .courseTitle, span').first();
      console.log(`Found course heading element:`, courseHeadingElem.length > 0);
      
      const courseHeading = courseHeadingElem.text().trim();
      console.log('Course heading text:', courseHeading);
      
      // Try different patterns to match course code and title
      let courseMatch = courseHeading.match(/([\w\s]+?)(?:\s{2,})-\s*(.*)/);
      
      // Alternative pattern - split by dash
      if (!courseMatch && courseHeading.includes('-')) {
        const parts = courseHeading.split('-').map(part => part.trim());
        if (parts.length >= 2) {
          courseMatch = [courseHeading, parts[0], parts.slice(1).join('-')];
        }
      }
      
      if (!courseMatch) {
        console.log('Could not parse course code and title, skipping');
        return;
      }
      
      // Clean up course code and title by removing extra spaces
      const courseCode = courseMatch[1].trim().replace(/\s+/g, ' ');
      const courseTitle = courseMatch[2].trim().replace(/\s+/g, ' ');
      
      // Process each session (lecture and section)
      const sessions: {
        days: string[],
        startTime: Date,
        endTime: Date,
        location: string,
        instructor: string
      }[] = [];
      
      console.log('Looking for course sessions...');
      
      // Try to find session rows
      let sessionRows = $(element).find('.row.session');
      
      // If no sessions found, try alternative selectors
      if (sessionRows.length === 0) {
        console.log('No .row.session elements found, trying alternative selectors');
        
        // Look for rows containing time information
        sessionRows = $(element).find('.row').filter((_, el) => {
          return $(el).text().match(/(AM|PM)-(AM|PM)/i) !== null;
        });
        
        if (sessionRows.length === 0) {
          // Try another approach - look for days column
          sessionRows = $(element).find('.row').filter((_, el) => {
            return $(el).find('[class*="days"]').length > 0 || $(el).find('div:contains("Days")').length > 0;
          });
        }
      }
      
      console.log(`Found ${sessionRows.length} session rows`);
      
      sessionRows.each((sessionIndex, sessionElement) => {
        console.log(`Processing session ${sessionIndex + 1}`);
        
        try {
          // Get days - try different selectors
          let daysElem = $(sessionElement).find('.col-lg-days, [class*="days"]').first();
          
          // Fallback if not found
          if (daysElem.length === 0) {
            daysElem = $(sessionElement).find('div').filter((_, el) => $(el).text().includes('Days')).first();
          }
          
          const daysText = daysElem.text().replace(/Days/g, '').trim();
          console.log('Days text:', daysText);
          const days = parseDaysOfWeek(daysText);
          
          // Get time - try different selectors
          let timeElem = $(sessionElement).find('.col-lg-time, [class*="time"]').first();
          
          // Fallback: look for elements containing time pattern
          if (timeElem.length === 0) {
            timeElem = $(sessionElement).find('div').filter((_, el) => {
              return $(el).text().match(/(AM|PM)-(AM|PM)/i) !== null;
            }).first();
          }
          
          const timeText = timeElem.text().replace(/Time/g, '').trim();
          console.log('Time text:', timeText);
          
          const { startTime, endTime } = parseTimeRange(timeText, quarterStartDate);
          
          // Get location - try different selectors
          let locationElem = $(sessionElement).find('.col-lg-location a, [class*="location"] a, a[href*="map"]').first();
          
          // Fallback: any element with location text
          if (locationElem.length === 0) {
            locationElem = $(sessionElement).find('div').filter((_, el) => $(el).text().includes('Location')).first();
          }
          
          // Clean up location, removing extra spaces
          const location = locationElem.text().replace(/Location/g, '').trim().replace(/\s+/g, ' ');
          console.log('Location text:', location);
          
          // Get instructor - try different selectors
          let instructorElem = $(sessionElement).find('.col-lg-instructor, [class*="instructor"]').first();
          
          // Fallback: any element with instructor text
          if (instructorElem.length === 0) {
            instructorElem = $(sessionElement).find('div').filter((_, el) => $(el).text().includes('Instructor')).first();
          }
          
          // Clean up instructor name, removing extra spaces
          const instructor = instructorElem.text().replace(/Instructor/g, '').trim().replace(/\s+/g, ' ');
          console.log('Instructor text:', instructor);
          
          sessions.push({
            days,
            startTime,
            endTime,
            location,
            instructor
          });
        } catch (error) {
          console.error(`Error processing session ${sessionIndex + 1}:`, error);
        }
      });
      
      // The first session is the lecture, subsequent ones are sections
      if (sessions.length > 0) {
        for (const session of sessions) {
          courseEvents.push({
            courseCode,
            courseTitle,
            days: session.days,
            startTime: session.startTime,
            endTime: session.endTime,
            location: session.location,
            instructor: session.instructor,
            quarterEndDate: quarterStartDate // This is actually the quarterStartDate now
          });
        }
      }
    });
    
    return courseEvents;
  } catch (error) {
    console.error("Error parsing GOLD HTML:", error);
    throw error;
  }
};

/**
 * Parses days of the week from GOLD format to RFC5545 format
 * @param daysText Text containing day information (e.g., "M W F")
 * @returns Array of RFC5545 day codes (e.g., ["MO", "WE", "FR"])
 */
function parseDaysOfWeek(daysText: string): string[] {
  const days = [];
  
  // First clean the text to handle different formats
  // Remove common separators and extra spaces
  const cleaned = daysText.replace(/[,;&\s]+/g, ' ').trim().toUpperCase();
  
  console.log('Parsing days from cleaned text:', cleaned);
  
  // Check for common day patterns
  if (cleaned.includes('M') || cleaned.includes('MON')) days.push('MO');
  
  // Check for Tuesday (T) but avoid counting Thursday (TH) as Tuesday
  const hasTuesday = 
    cleaned.includes('TU') || 
    (cleaned.includes('T') && !cleaned.includes('TH')) || 
    cleaned.includes('TUES');
  
  if (hasTuesday) days.push('TU');
  
  // Check for Wednesday
  if (cleaned.includes('W') || cleaned.includes('WED')) days.push('WE');
  
  // Check for Thursday (TH or R at UCSB)
  if (cleaned.includes('TH') || cleaned.includes('R') || cleaned.includes('THU')) days.push('TH');
  
  // Check for Friday
  if (cleaned.includes('F') || cleaned.includes('FRI')) days.push('FR');
  
  // Double check the result makes sense
  if (days.length === 0) {
    console.warn('Could not parse any days from:', daysText);
    // Default to Monday if we couldn't parse anything
    return ['MO'];
  }
  
  console.log('Parsed days:', days.join(','));
  return days;
}

/**
 * Parses time range from GOLD format to ISO format
 * @param timeText Text containing time information (e.g., "2:00 PM-2:50 PM")
 * @param quarterStartDate Reference date for setting the correct date
 * @returns Object with start and end times as Date objects
 */
function parseTimeRange(timeText: string, _quarterStartDate: Date): { startTime: Date, endTime: Date } {
  // Try different time format patterns
  let timeMatch = timeText.match(/(\d+):(\d+)\s+(AM|PM)-(\d+):(\d+)\s+(AM|PM)/i);
  
  if (!timeMatch) {
    // Try alternative format: 9:30 AM-10:45 AM or 9AM-10AM
    timeMatch = timeText.match(/(\d+)(?::(\d+))?\s*(AM|PM)-(\d+)(?::(\d+))?\s*(AM|PM)/i);
  }
  
  if (!timeMatch) {
    throw new Error(`Could not parse time range: ${timeText}`);
  }
  
  let startHour, startMinute, startAmPm, endHour, endMinute, endAmPm;
  
  if (timeMatch.length === 7) {
    const [, sHour, sMinute, sAmPm, eHour, eMinute, eAmPm] = timeMatch;
    startHour = sHour;
    startMinute = sMinute; 
    startAmPm = sAmPm;
    endHour = eHour;
    endMinute = eMinute;
    endAmPm = eAmPm;
  } else {
    // Handle case where minutes might be missing
    const [, sHour, sMinute, sAmPm, eHour, eMinute, eAmPm] = timeMatch;
    startHour = sHour;
    startMinute = sMinute || "0";
    startAmPm = sAmPm;
    endHour = eHour;
    endMinute = eMinute || "0";
    endAmPm = eAmPm;
  }
  
  // Create date objects for today with the course times
  const today = new Date();
  
  // Create start time
  const startTime = new Date(today);
  let parsedStartHour = parseInt(startHour);
  // Convert 12-hour format to 24-hour
  if (startAmPm.toUpperCase() === 'PM' && parsedStartHour < 12) parsedStartHour += 12;
  if (startAmPm.toUpperCase() === 'AM' && parsedStartHour === 12) parsedStartHour = 0;
  
  startTime.setHours(parsedStartHour, parseInt(startMinute), 0, 0);
  
  // Create end time
  const endTime = new Date(today);
  let parsedEndHour = parseInt(endHour);
  // Convert 12-hour format to 24-hour
  if (endAmPm.toUpperCase() === 'PM' && parsedEndHour < 12) parsedEndHour += 12;
  if (endAmPm.toUpperCase() === 'AM' && parsedEndHour === 12) parsedEndHour = 0;
  
  endTime.setHours(parsedEndHour, parseInt(endMinute), 0, 0);
  
  // If end time is before start time, something went wrong
  if (endTime < startTime) {
    console.warn('End time is before start time, applying fix');
    
    // Default to 1 hour duration
    endTime.setTime(startTime.getTime() + 60 * 60 * 1000);
  }
  
  return { startTime, endTime };
}