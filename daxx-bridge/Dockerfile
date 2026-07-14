FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

EXPOSE 3334
CMD ["npx", "tsx", "src/index.ts"]
