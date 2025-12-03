# Imagen base: Node sobre Debian (NO Alpine)
FROM node:18

# Carpeta de trabajo dentro del contenedor
WORKDIR /app/server

# 1) Copiar sólo las dependencias del backend
COPY server/package.json server/package-lock.json* ./

# 2) Instalar dependencias del backend
RUN npm install

# 3) Copiar el código del backend
COPY server/. .

# 4) Generar Prisma Client dentro del contenedor
RUN npx prisma generate

# 5) Variables y puerto
ENV PORT=4000
EXPOSE 4000

# 6) Comando de inicio
CMD ["npm", "start"]
