FROM node:20-slim

WORKDIR /app

# Lockfile first so the dependency layer is cached across source edits;
# npm ci is deterministic and faster than npm install.
COPY services/web/package.json services/web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY services/web .

EXPOSE 5173
CMD ["npm", "run", "dev"]
