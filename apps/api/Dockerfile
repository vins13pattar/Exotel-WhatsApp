# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json .eslintrc.cjs ./
COPY prisma ./prisma
COPY openapi.yml ./openapi.yml
COPY src ./src
RUN npm install --production=false
RUN npx prisma generate
RUN npm run build

# runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/openapi.yml ./openapi.yml
COPY package.json ./
USER app
CMD ["node", "dist/index.js"]
