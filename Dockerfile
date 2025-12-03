FROM node:18-alpine 

# Carpeta de trabajo dentro del contenedor
WORKDIR /app/server

# 1) Copiamos SOLO las dependencias del backend
COPY server/package.json server/package-lock.json* ./

# 2) Instalamos dependencias (dentro del contenedor, para Linux)
RUN npm install

# 3) Copiamos solo lo necesario del backend (sin node_modules)
COPY server/prisma ./prisma
COPY server/src ./src

# 4) Generar Prisma Client
RUN npx prisma generate

# 5) Exponer el puerto
EXPOSE 4000

# 6) Comando de inicio
CMD ["npm", "start"]
