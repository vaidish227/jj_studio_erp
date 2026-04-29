# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Build the app (VITE_API_URL can be passed as an ARG or set in compose)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:stable-alpine

COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx config for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
