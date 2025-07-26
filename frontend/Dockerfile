FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (use npm install instead of ci to resolve any lock file issues)
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]