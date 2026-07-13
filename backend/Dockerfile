FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
FROM dependencies AS build
COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run prisma:generate && npm run build
FROM dependencies AS migration
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
USER node
CMD ["npm", "run", "prisma:migrate"]
FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
