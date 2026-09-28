FROM node:20-slim

WORKDIR /app

COPY services/web/package.json .
RUN npm install

COPY services/web .

EXPOSE 5173
CMD ["npm", "run", "dev"]
