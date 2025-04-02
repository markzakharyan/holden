# UCSB Schedule to Calendar

A simple web application that helps UCSB students add their class schedules to Google Calendar automatically. Users sign in with their UCSB Google account, upload a screenshot of their GOLD schedule, and the application uses Claude API to parse the schedule and add it to their Google Calendar.

## Features

- Google OAuth authentication with UCSB email restriction
- Upload and preview schedule screenshots
- Claude API integration for image parsing
- Google Calendar integration for adding classes

## Prerequisites

- Node.js (v16+)
- Google OAuth credentials
- Anthropic API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ANTHROPIC_API_KEY=your_anthropic_api_key
   SESSION_SECRET=random_session_secret
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start the development server
- `npm start` - Run the production server
- `npm run build` - Build the client for production
- `npm test` - Run tests
- `npm test:single "test name"` - Run a specific test
- `npm run lint` - Run linter
- `npm run format` - Fix code formatting
- `npm run typecheck` - Check TypeScript types

## How It Works

1. User signs in with their UCSB Google account
2. User uploads a screenshot of their GOLD schedule
3. The application uses Claude API to extract course information from the image
4. The extracted data is used to create Google Calendar events
5. Events are added to the user's calendar with proper recurrence rules for the quarter

## Technologies Used

- Vite + TypeScript for bundling and type safety
- Express.js for the server
- Claude API for image parsing
- Google Calendar API for event creation
- Passport.js for authentication