# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app

# Copy backend dependencies and install production only
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend from Stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Expose port (default 5000)
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

# Start server
CMD ["node", "server.js"]

