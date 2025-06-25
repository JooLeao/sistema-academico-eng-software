// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa as bibliotecas necessárias
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Cria o servidor Express
const app = express();
const PORTA = 3000;

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json());

// Configura a conexão com o banco de dados
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

/*
================================================================================
  ROTAS DE CADASTRO E LOGIN (JÁ EXISTENTES)
================================================================================
*/
// Rota de Cadastro
app.post('/usuarios', async (req, res) => {
    const { nome_completo, email, senha, tipo, cpf } = req.body;
    if (!nome_completo || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Todos os campos (nome_completo, email, senha, tipo) são obrigatórios.' });
    }
    if (tipo === 'professor' && !cpf) {
        return res.status(400).json({ error: 'CPF é obrigatório para o cadastro de professor.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const senhaHash = await bcrypt.hash(senha, 10);
        const usuarioQuery = `INSERT INTO Usuarios (nome_completo, email, senha, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nome_completo, email, tipo;`;
        const novoUsuarioResult = await client.query(usuarioQuery, [nome_completo, email, senhaHash, tipo]);
        const novoUsuario = novoUsuarioResult.rows[0];
        if (tipo === 'professor') {
            const professorQuery = 'INSERT INTO Professores (usuario_id, cpf) VALUES ($1, $2)';
            await client.query(professorQuery, [novoUsuario.id, cpf.replace(/\D/g, '')]);
        }
        await client.query('COMMIT');
        res.status(201).json(novoUsuario);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email ou CPF já cadastrado.' });
        }
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    } finally {
        client.release();
    }
});

// Rota de Login de Aluno
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) { return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); }
  try {
    const result = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
    const usuario = result.rows[0];
    if (!usuario) { return res.status(404).json({ error: 'Usuário não encontrado.' }); }
    if (usuario.tipo !== 'aluno') { return res.status(403).json({ error: 'Acesso negado. Utilize o portal do professor.' }); }
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) { return res.status(401).json({ error: 'Senha inválida.' }); }
    const tokenPayload = { id: usuario.id, email: usuario.email, tipo: usuario.tipo };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
    delete usuario.senha;
    res.status(200).json({ message: 'Login realizado com sucesso!', usuario, token });
  } catch (error) {
    console.error('Erro ao fazer login de aluno:', error);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

// Rota de Login de Professor
app.post('/login/professor', async (req, res) => {
    const { cpf, senha } = req.body;
    if (!cpf || !senha) { return res.status(400).json({ error: 'CPF e senha são obrigatórios.' }); }
    try {
        const query = `SELECT u.* FROM Usuarios u JOIN Professores p ON u.id = p.usuario_id WHERE p.cpf = $1 AND u.tipo = 'professor';`;
        const result = await pool.query(query, [cpf.replace(/\D/g, '')]);
        const usuario = result.rows[0];
        if (!usuario) { return res.status(404).json({ error: 'Professor não encontrado com o CPF informado.' }); }
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) { return res.status(401).json({ error: 'Senha inválida.' }); }
        const tokenPayload = { id: usuario.id, email: usuario.email, tipo: usuario.tipo };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
        delete usuario.senha;
        res.status(200).json({ message: 'Login de professor realizado com sucesso!', usuario, token });
    } catch (error) {
        console.error('Erro ao fazer login de professor:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
});

/*
================================================================================
  NOVA ROTA DE RECUPERAÇÃO DE SENHA (POST /recuperar-senha)
================================================================================
*/
app.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'O campo email é obrigatório.' });
    }

    try {
        // 1. Verifica se o email existe na tabela de usuários
        const query = 'SELECT * FROM Usuarios WHERE email = $1';
        const result = await pool.query(query, [email]);
        const usuario = result.rows[0];

        // 2. Se o email não for encontrado, retorna um erro 404
        if (!usuario) {
            // Nota de segurança: Em produção, por vezes é melhor retornar uma mensagem de sucesso
            // mesmo que o email não exista, para não confirmar a um atacante quais emails são válidos.
            // Para nosso projeto, o erro 404 é mais claro para debug.
            return res.status(404).json({ error: 'Email não encontrado no sistema.' });
        }

        // 3. Se o email existe, simula o envio e retorna sucesso.
        // Em um projeto real, aqui você geraria um token de recuperação,
        // o salvaria no banco com um tempo de expiração e enviaria por email.
        console.log(`SIMULAÇÃO: Enviando email de recuperação para ${email}`);
        res.status(200).json({ message: 'Se o email estiver cadastrado, um link de recuperação foi enviado.' });

    } catch (error) {
        console.error('Erro no processo de recuperação de senha:', error);
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
