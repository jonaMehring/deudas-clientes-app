APP DE GESTIÓN DE DEUDAS DE CLIENTES
===================================

Estructura:
- client/  -> React + Vite + Tailwind (front)
- server/  -> Node + Express + Prisma (API)

1) CONFIGURAR SERVER (API)
--------------------------
cd server
cp .env.example .env
# editá .env y poné la DATABASE_URL de tu MySQL de Hostinger

npm install
npx prisma generate
npx prisma migrate dev --name init

npm run dev   (para desarrollo local)
# La API quedará en http://localhost:4000

2) CONFIGURAR CLIENT (FRONT)
----------------------------
cd client
npm install

# En desarrollo, el front apunta por defecto a:
#   VITE_API_URL = http://localhost:4000/api
# Podés sobreescribirlo creando un archivo .env:
#   VITE_API_URL="https://tu-api.com/api"

npm run dev   (abre http://localhost:5173)

3) DESPLIEGUE
-------------
- API (server): se puede subir a Koyeb, Railway, etc. usando la misma DATABASE_URL de Hostinger.
- FRONT (client): se build-ea con:
    npm run build
  y se sube el contenido de client/dist a tu hosting estático (por ejemplo Hostinger).

