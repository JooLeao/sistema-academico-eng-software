# Usar uma imagem base oficial do Node.js (versão 18, leve)
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copiar os arquivos de dependências primeiro para otimizar o cache
# Isso faz com que o 'npm install' só rode de novo se o package.json mudar
COPY package*.json ./

# Instalar as dependências do projeto
RUN npm install

# Copiar o resto dos arquivos do projeto para o diretório de trabalho
COPY . .

# Expor a porta que nossa aplicação usa para o Docker saber
EXPOSE 3000

# O comando para iniciar a aplicação quando o container rodar
CMD [ "node", "index.js" ]