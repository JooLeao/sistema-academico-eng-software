# Versão da imagem base
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copiar package.json e package-lock.json da pasta 'backend/' na raiz do host
# para o WORKDIR no container.
COPY backend/package*.json ./

# Instalar as dependências
RUN npm install

# Copiar o restante do código do backend (index.js, etc.) da pasta 'backend/'
# para o WORKDIR no container.
COPY backend/. .

# Copiar a pasta 'frontend/' da raiz do host para uma subpasta chamada 'public/'
# dentro do WORKDIR do container.
COPY frontend/ ./public/ 

# Expor a porta que a aplicação vai rodar
EXPOSE 3000

# O comando para iniciar a aplicação
CMD ["node", "index.js"]