// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa as bibliotecas necessárias
const express = require('express');
const { Pool } = require('pg'); // Driver do PostgreSQL
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Importa a biblioteca CORS

// Cria o servidor Express
const app = express();
const PORTA = 3000;

// --- MIDDLEWARES ---
// Habilita o CORS para que seu frontend possa fazer requisições para esta API
app.use(cors()); 

// Adiciona o middleware para o Express conseguir interpretar o corpo (body) das requisições em formato JSON.
app.use(express.json());

// Configura a conexão com o banco de dados usando as variáveis de ambiente
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

/*
================================================================================
  ROTA DE CADASTRO DE USUÁRIO (POST /usuarios)
================================================================================
*/
app.post('/usuarios', async (req, res) => {
    const { nome_completo, email, senha, tipo } = req.body;

    if (!nome_completo || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios: nome_completo, email, senha, tipo.' });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const query = `
            INSERT INTO Usuarios (nome_completo, email, senha, tipo)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nome_completo, email, tipo, criado_em; 
        `;
        const novoUsuario = await pool.query(query, [nome_completo, email, senhaHash, tipo]);
        res.status(201).json(novoUsuario.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Este email já está cadastrado.' });
        }
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
});


/*
================================================================================
  ROTA DE LOGIN (POST /login)
================================================================================
*/
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const query = 'SELECT * FROM Usuarios WHERE email = $1';
    const result = await pool.query(query, [email]);
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Senha inválida.' });
    }

    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    delete usuario.senha;

    res.status(200).json({
      message: 'Login realizado com sucesso!',
      usuario,
      token,
    });

  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});


/*
================================================================================
  INICIALIZAÇÃO DO SERVIDOR
================================================================================
*/
app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});
