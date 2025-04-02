# UCSB GOLD Schedule to Google Calendar

This application helps UCSB students automatically add their class schedules to Google Calendar. Users sign in with their UCSB Google account, upload their GOLD schedule HTML file, and the application parses it to create recurring calendar events for all their classes.

## Project Overview

### Key Components:
- **Authentication**: Google OAuth for UCSB students
- **Frontend**: Minimalist UI for schedule upload and quarter selection
- **Backend**: Express.js API for processing schedules and calendar integration
- **Data Processing**: HTML parsing with Cheerio
- **External Integration**: Google Calendar API

### Key Workflows:
1. User authentication with Google (UCSB email required)
2. HTML schedule upload with date selection
3. Schedule parsing to extract course details
4. Google Calendar event creation with proper recurrence

## Build & Test Commands
- `npm install` - Install dependencies
- `npm run dev` - Run the development server
- `npm start` - Run the production server (with Redis)
- `npm run start:no-redis` - Run the production server without Redis
- `npm run build` - Build for production
- `npm test` - Run all tests
- `npm test:single "test name"` - Run a specific test
- `npm run lint` - Run linter
- `npm run format` - Fix code formatting
- `npm run typecheck` - Check TypeScript types

## Code Style Guidelines
- **Formatting**: Use Prettier with default settings
- **Imports**: Group imports (1. external, 2. internal)
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Types**: Always use TypeScript types, avoid `any`
- **Error Handling**: Use try/catch for promises and async functions
- **API Endpoints**: Use descriptive names, follow RESTful conventions
- **Documentation**: JSDoc comments for functions

## Environment Setup
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=random_session_secret
REDIS_URL=redis://localhost:6379 # Required in production
```

## Important Implementation Notes

### Timezone Handling
- All dates must be handled consistently with the America/Los_Angeles timezone
- When parsing times from GOLD HTML, use setUTCHours to avoid timezone conversion issues
- When creating Google Calendar events, always specify timeZone: "America/Los_Angeles"

### Session Management
- Development uses in-memory session storage
- Production uses Redis for session storage when available
- A fallback to memory storage is provided for environments without Redis
- Access tokens and refresh tokens are stored in the user's session
- Use the `DISABLE_REDIS=true` environment variable to explicitly disable Redis

Check existing code in the file you're modifying to maintain consistency.