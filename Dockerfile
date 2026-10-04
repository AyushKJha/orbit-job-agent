FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production PORT=10000 JOB_AGENT_DATA=/var/data/orbit
RUN mkdir -p /var/data/orbit && chown -R node:node /app /var/data
USER node
EXPOSE 10000
CMD ["node","server.mjs"]
