# Stdio MCP server for Varosity AI. Pass VAROSITY_API_KEY at run time:
#   docker run -i --rm -e VAROSITY_API_KEY=vsk_... varosity/mcp-server
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci --ignore-scripts && npx tsc -p .

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY bin ./bin
COPY package.json ./
USER node
ENTRYPOINT ["node", "bin/varosity-mcp.mjs"]
