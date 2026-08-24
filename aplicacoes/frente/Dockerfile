# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS dependencias
WORKDIR /codigo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY aplicacoes/frente/package.json ./aplicacoes/frente/package.json
COPY aplicacoes/api/package.json ./aplicacoes/api/package.json
RUN npm ci

FROM dependencias AS desenvolvimento
WORKDIR /codigo
COPY . .
EXPOSE 3000
CMD ["npm", "run", "desenvolver", "--workspace", "@netcatbank/frente"]

FROM dependencias AS construcao
WORKDIR /codigo
COPY . .
RUN npm run construir --workspace @netcatbank/frente

FROM node:24-alpine AS execucao
WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S aplicacao && adduser -S aplicacao -G aplicacao
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/frente/.next/standalone ./
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/frente/.next/static ./aplicacoes/frente/.next/static
COPY --from=construcao --chown=aplicacao:aplicacao /codigo/aplicacoes/frente/public ./aplicacoes/frente/public
USER aplicacao
EXPOSE 3000
CMD ["node", "aplicacoes/frente/server.js"]

