# Development Guidelines for Claude

You will be making a simple vite-express application that is VERY minimalist. Users will sign in with Google and if it's a UCSB email address, they will be allowed to upload a screenshot of their GOLD (Gaucho On-Line Database) schedule for the quarter. Then, it will use the Anthropic Claude API to add their schedule to their Google Calendar for the duration of the quarter.

## Build & Test Commands
- `npm install` - Install dependencies
- `npm start` - Run the development server
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

Check existing code in the file you're modifying to maintain consistency.