#!/bin/bash

# HoldenBot Setup Script

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js before continuing."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "Node.js version 16 or higher is required. Current version: $NODE_VERSION"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
SESSION_SECRET=$(openssl rand -hex 32)
EOF
    echo ".env file created. Please update it with your API keys."
else
    echo ".env file already exists. Skipping creation."
fi

# Run typecheck
echo "Running TypeScript type check..."
npm run typecheck

echo ""
echo "Setup complete! You can now run the application with:"
echo "npm run dev"
echo ""
echo "Don't forget to update the .env file with your API keys!"