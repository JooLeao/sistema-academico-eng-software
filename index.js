// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa as bibliotecas necessárias
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Cria o servidor Express
const app = express();
const PORTA = 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve arquivos estáticos (HTML, CSS, JS, etc.)

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

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
  MIDDLEWARE DE AUTENTICAÇÃO E AUTORIZAÇÃO
================================================================================
*/
function verificarTokenEAutorizacao(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido. Acesso negado.' });
    }
    const token = authHeader.split(' ')[1]; // Espera-se "Bearer TOKEN"
    if (!token) {
        return res.status(401).json({ error: 'Formato de token inválido. Acesso negado.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        console.error('Erro na verificação do token:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expirado. Faça login novamente.' });
        }
        return res.status(403).json({ error: 'Token inválido. Acesso negado.' });
    }
}

/*
================================================================================
  ROTAS DE CADASTRO E LOGIN (COM SENHA EM TEXTO PURO)
================================================================================
*/
// Rota de Cadastro (APENAS PROFESSORES)
app.post('/usuarios', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem cadastrar novos usuários.' });
    }
    const { nome_completo, email, senha, tipo, cpf, matricula, curso, periodo } = req.body;
    if (!nome_completo || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Campos obrigatórios (nome, email, senha, tipo) faltando.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const usuarioQuery = `INSERT INTO Usuarios (nome_completo, email, senha, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nome_completo, email, tipo;`;
        const novoUsuarioResult = await client.query(usuarioQuery, [nome_completo, email, senha, tipo]);
        const novoUsuario = novoUsuarioResult.rows[0];

        if (tipo === 'professor') {
            if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório para professor.' });
            await client.query('INSERT INTO Professores (usuario_id, cpf) VALUES ($1, $2)', [novoUsuario.id, cpf.replace(/\D/g, '')]);
        } else if (tipo === 'aluno') {
            const matriculaFinal = matricula || `AUTO-${Date.now()}`;
            const cursoFinal = curso || 'Engenharia de Software';
            const periodoFinal = periodo || 1;
            await client.query('INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES ($1, $2, $3, $4)', [novoUsuario.id, matriculaFinal, cursoFinal, periodoFinal]);
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
    
    // Comparação de senha em texto puro
    const senhaCorreta = (senha === usuario.senha); 
    
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

// Rota de Login de Professor (agora apenas com CPF e Senha)
app.post('/login/professor', async (req, res) => {
    const { cpf, senha } = req.body;
    if (!cpf || !senha) {
        return res.status(400).json({ error: 'CPF e senha são obrigatórios.' });
    }
    try {
        // Query para encontrar o usuário pelo CPF na tabela de professores
        const query = `
            SELECT u.* FROM Usuarios u 
            JOIN Professores p ON u.id = p.usuario_id 
            WHERE p.cpf = $1 AND u.tipo = 'professor';
        `;
        const result = await pool.query(query, [cpf.replace(/\D/g, '')]);
        const usuario = result.rows[0];
        
        if (!usuario) {
            return res.status(404).json({ error: 'Professor não encontrado com o CPF informado.' });
        }
        
        // Comparação de senha em texto puro
        if (senha !== usuario.senha) {
            return res.status(401).json({ error: 'Senha inválida.' });
        }

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
  ROTA PROTEGIDA PARA BUSCAR DETALHES DO USUÁRIO
================================================================================
*/
app.get('/usuarios/:id', verificarTokenEAutorizacao, async (req, res) => {
    const { id } = req.params;
    if (req.usuario.id !== parseInt(id) && req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    const client = await pool.connect();
    try {
        const queryUsuario = `SELECT id, nome_completo, email, tipo FROM Usuarios WHERE id = $1;`;
        const resultUsuario = await client.query(queryUsuario, [id]);
        const usuario = resultUsuario.rows[0];

        if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

        let usuarioDetalhes = { ...usuario };
        if (usuario.tipo === 'aluno') {
            const resultAluno = await client.query(`SELECT matricula, curso, periodo FROM Alunos WHERE usuario_id = $1;`, [id]);
            if (resultAluno.rows.length > 0) usuarioDetalhes.aluno_info = resultAluno.rows[0];
        } else if (usuario.tipo === 'professor') {
            const resultProfessor = await client.query(`SELECT cpf FROM Professores WHERE usuario_id = $1;`, [id]);
            if (resultProfessor.rows.length > 0) usuarioDetalhes.professor_info = resultProfessor.rows[0];
        }
        res.status(200).json(usuarioDetalhes);
    } catch (error) {
        console.error('Erro ao buscar detalhes do usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  ROTA PROTEGIDA PARA ALTERAÇÃO DE SENHA (COM TEXTO PURO)
================================================================================
*/
app.post('/alterar-senha', verificarTokenEAutorizacao, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.usuario.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
    }
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT senha FROM Usuarios WHERE id = $1', [userId]);
        const usuario = result.rows[0];
        if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

        // Comparação de senha em texto puro
        if (currentPassword !== usuario.senha) {
            return res.status(401).json({ error: 'Senha atual incorreta.' });
        }

        // Salva a nova senha como texto puro
        await client.query('UPDATE Usuarios SET senha = $1 WHERE id = $2;', [newPassword, userId]);
        res.status(200).json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  ROTAS DE NOTÍCIAS (CRUD)
================================================================================
*/
app.post('/noticias', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem publicar notícias.' });
    }
    const { titulo, conteudo, categoria } = req.body;
    if (!titulo || !conteudo) {
        return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });
    }
    const query = `INSERT INTO Noticias (titulo, conteudo, categoria, autor_id) VALUES ($1, $2, $3, $4) RETURNING *;`;
    const result = await pool.query(query, [titulo, conteudo, categoria || 'Geral', req.usuario.id]);
    res.status(201).json(result.rows[0]);
});

app.get('/noticias', async (req, res) => {
    const query = `
        SELECT n.id, n.titulo, n.conteudo, n.categoria, n.data_publicacao, u.nome_completo as autor_nome
        FROM Noticias n
        JOIN Usuarios u ON n.autor_id = u.id
        ORDER BY n.data_publicacao DESC;
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
});

/*
================================================================================
  ROTAS PARA BOLETINS
================================================================================
*/
// Rota para professor buscar boletim de um aluno específico
app.get('/boletins/aluno/:alunoId', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { alunoId } = req.params;
    const client = await pool.connect();
    try {
        const alunoQuery = 'SELECT u.nome_completo, a.matricula FROM Usuarios u JOIN Alunos a ON u.id = a.usuario_id WHERE a.id = $1';
        const alunoResult = await client.query(alunoQuery, [alunoId]);
        if (alunoResult.rows.length === 0) return res.status(404).json({ error: 'Aluno não encontrado.' });
        
        const boletimQuery = `
            SELECT d.nome as disciplina_nome, m.*, t.ano, t.semestre
            FROM Matriculas m
            JOIN Turmas t ON m.turma_id = t.id
            JOIN Disciplinas d ON t.disciplina_id = d.id
            WHERE m.aluno_id = $1 ORDER BY t.ano DESC, t.semestre DESC, d.nome ASC;
        `;
        const boletimResult = await client.query(boletimQuery, [alunoId]);
        res.status(200).json({ aluno: alunoResult.rows[0], boletim: boletimResult.rows });
    } catch (error) {
        console.error('Erro ao buscar boletim do aluno:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno.' });
    } finally {
        client.release();
    }
});

// >>> ROTA ADICIONADA: Para o aluno logado buscar seu próprio boletim
app.get('/alunos/boletim', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'aluno') {
        return res.status(403).json({ error: 'Apenas alunos podem acessar seu próprio boletim.' });
    }
    const client = await pool.connect();
    try {
        const alunoResult = await client.query('SELECT id FROM Alunos WHERE usuario_id = $1', [req.usuario.id]);
        if (alunoResult.rows.length === 0) return res.status(404).json({ error: 'Dados de aluno não encontrados.' });
        
        const alunoId = alunoResult.rows[0].id;
        const boletimQuery = `
            SELECT d.nome as disciplina_nome, m.nota1, m.nota2, m.media_final, m.frequencia, m.status
            FROM Matriculas m
            JOIN Turmas t ON m.turma_id = t.id
            JOIN Disciplinas d ON t.disciplina_id = d.id
            WHERE m.aluno_id = $1 ORDER BY d.nome ASC;
        `;
        const boletimResult = await client.query(boletimQuery, [alunoId]);
        res.status(200).json(boletimResult.rows);
    } catch (error) {
        console.error('Erro ao buscar boletim do aluno:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  >>> ROTAS ADICIONADAS: Para o Portal do Professor funcionar
================================================================================
*/
// Rota para buscar TODOS os alunos (necessária para a tela de boletins do professor)
app.get('/alunos', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem acessar esta lista.' });
    }
    const query = `
        SELECT u.id as usuario_id, u.nome_completo, u.email, a.id as aluno_id, a.matricula 
        FROM Usuarios u JOIN Alunos a ON u.id = a.usuario_id 
        WHERE u.tipo = 'aluno' ORDER BY u.nome_completo;
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
});

// Rota para buscar as turmas de um professor
app.get('/professores/turmas', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') return res.status(403).json({ error: 'Acesso negado.' });
    
    const professorUsuarioId = req.usuario.id;
    const query = `
        SELECT t.id, d.nome as disciplina_nome, d.codigo as disciplina_codigo, t.ano, t.semestre, t.horario
        FROM Turmas t
        JOIN Disciplinas d ON t.disciplina_id = d.id
        JOIN Professores p ON t.professor_id = p.id
        WHERE p.usuario_id = $1 ORDER BY d.nome;
    `;
    const result = await pool.query(query, [professorUsuarioId]);
    res.status(200).json(result.rows);
});


/*
================================================================================
  ROTAS DE RECUPERAÇÃO DE SENHA (SIMULAÇÃO)
================================================================================
*/
app.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'O campo email é obrigatório.' });
    
    try {
        const result = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            // Mesmo que não encontre, respondemos com sucesso para não revelar quais emails existem.
            return res.status(200).json({ message: 'Se o email estiver cadastrado, um link de recuperação foi enviado.' });
        }
        
        console.log(`SIMULAÇÃO: Enviando email de recuperação para ${email}`);
        res.status(200).json({ message: 'Se o email estiver cadastrado, um link de recuperação foi enviado.' });

    } catch(error) {
        console.error('Erro na recuperação de senha:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

/*
================================================================================
  >>> NOVA ROTA: Buscar alunos de uma turma específica
================================================================================
*/
app.get('/turmas/:turmaId/alunos', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { turmaId } = req.params;

    try {
        const query = `
            SELECT u.nome_completo, a.matricula
            FROM Usuarios u
            JOIN Alunos a ON u.id = a.usuario_id
            JOIN Matriculas m ON a.id = m.aluno_id
            WHERE m.turma_id = $1
            ORDER BY u.nome_completo;
        `;
        const result = await pool.query(query, [turmaId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar alunos da turma:', error);
        res.status(500).json({ error: 'Erro interno ao buscar alunos.' });
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