# Dockerfile
FROM node:14
ENV HOST 0.0.0.0
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]