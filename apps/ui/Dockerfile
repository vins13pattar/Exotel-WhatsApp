# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json vite.config.ts .eslintrc.cjs index.html ./
COPY src ./src
RUN npm install --production=false
RUN npm run build

# runtime stage
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
