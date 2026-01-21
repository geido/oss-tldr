FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
