FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Limpiar cache de npm e instalar dependencias
RUN npm cache clean --force && npm install --only=production

# Copiar el código fuente
COPY . .

# Exponer el puerto correcto
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["npm", "start"]