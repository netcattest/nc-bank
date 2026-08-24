# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS dependencias
WORKDIR /codigo
RUN apk add --no-cache fontconfig ttf-dejavu ttf-liberation
COPY package.json package-lock.json ./
COPY aplicacoes/frente/package.json ./aplicacoes/frente/package.json
COPY aplicacoes/api/package.json ./aplicacoes/api/package.json
RUN npm ci

FROM dependencias AS desenvolvimento
WORKDIR /codigo
COPY . .
EXPOSE 3001
CMD ["npm", "run", "desenvolver", "--workspace", "@netcatbank/api"]

FROM dependencias AS construcao
WORKDIR /codigo
COPY . .
RUN npm run construir --workspace @netcatbank/api
RUN npm prune --omit=dev

FROM node:24-alpine AS execucao
WORKDIR /app
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORTA=3001
RUN apk add --no-cache fontconfig ttf-dejavu ttf-liberation \
  && addgroup -S aplicacao \
  && adduser -S aplicacao -G aplicacao
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/node_modules ./node_modules
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/package.json ./package.json
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/api/package.json ./aplicacoes/api/package.json
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/api/assets ./aplicacoes/api/assets
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/api/dist ./aplicacoes/api/dist
USER aplicacao
EXPOSE 3001
CMD ["node", "aplicacoes/api/dist/servidor.js"]
