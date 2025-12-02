# 1. Imagen base
FROM node:18-alpine

# 2. Carpeta de trabajo base
WORKDIR /app

# 3. Copiar package.json del server
COPY server/package.json server/package-lock.json* ./server/

# 4. Instalar dependencias del backend
WORKDIR /app/server
RUN npm install

# 5. Copiar TODO el código del backend
COPY server/. .

# 6. Generar Prisma Client
RUN npx prisma generate

# 7. Exponer puerto
EXPOSE 4000

# 8. Comando de inicio
CMD ["npm", "start"]
