FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose port (Railway will override with PORT env var)
EXPOSE 3000

# Start the app (Railway's PORT env var takes precedence)
CMD ["node", ".next/standalone/server.js"]
