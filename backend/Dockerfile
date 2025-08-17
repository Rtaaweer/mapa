FROM node:18

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el código fuente
COPY . .

# Exponer el puerto correcto
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "server.js"]