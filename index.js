// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// --- Bloco de Teste para Debug ---
// Este bloco vai nos mostrar exatamente o que o Node.js está lendo do seu arquivo .env
console.log('--- VARIÁVEIS DE AMBIENTE CARREGADAS ---');
console.log('Host lido:', process.env.DB_HOST);
console.log('Porta lida:', process.env.DB_PORT);
console.log('Database lido:', process.env.DB_DATABASE);
console.log('------------------------------------');
// --- Fim do Bloco de Teste ---

// Importa as bibliotecas necessárias
const express = require('express');
const { Pool } = require('pg'); // Driver do PostgreSQL

// Cria o servidor Express
const app = express();
const PORTA = 3000; // O servidor vai rodar na porta 3000

// Configura a conexão com o banco de dados usando as variáveis de ambiente
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT), // Correção: Garante que a porta seja um número
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Rota de teste para verificar a conexão com o banco
app.get('/testar-conexao', async (req, res) => {
    try {
        const client = await pool.connect(); // Tenta pegar uma conexão
        client.release(); // Libera a conexão imediatamente
        res.status(200).send('Conexão com o banco de dados bem-sucedida!');
    } catch (error) {
        // Mostra o erro real e detalhado no terminal
        console.error('Erro detalhado ao conectar ao banco de dados:', error);
        res.status(500).send('Erro ao conectar ao banco de dados.');
    }
});

// Rota principal para testar se o servidor está no ar
app.get('/', (req, res) => {
    res.send('Olá! Seu servidor está no ar.');
});

// Inicia o servidor para ele começar a "ouvir" as requisições
app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});