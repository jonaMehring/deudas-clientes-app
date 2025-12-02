# 1. Imagen base
FROM node:18-alpine

# 2. Crear app
WORKDIR /app

# 3. Copiar dependencias
COPY package.json package-lock.json* ./

# 4. Instalar
RUN npm install

# 5. Copiar el código
COPY . .

# 6. Generar Prisma Client
RUN npx prisma generate

# 7. Exponer puerto
EXPOSE 4000

# 8. Comando de inicio
CMD ["npm", "start"]
