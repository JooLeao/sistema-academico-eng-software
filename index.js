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

// Servir arquivos estáticos (HTML, CSS, JS, imagens do frontend)
// Isso fará com que o servidor sirva qualquer arquivo da pasta raiz (onde estão index.html, login-aluno.html, etc.)
app.use(express.static(__dirname));

// Rota para a página inicial (se você quiser que http://localhost:3000 carregue index.html diretamente)
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
// Middleware para verificar o token JWT e adicionar informações do usuário à requisição
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
        // Verifica e decodifica o token usando a chave secreta JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded; // Adiciona as informações do usuário decodificadas ao objeto de requisição
        next(); // Prossegue para a próxima função na rota
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
  ROTAS DE CADASTRO E LOGIN
================================================================================
*/
// Rota de Cadastro (APENAS PROFESSORES AUTENTICADOS PODEM USAR)
app.post('/usuarios', verificarTokenEAutorizacao, async (req, res) => {
    // Verifica se o usuário que está fazendo a requisição é um professor
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem cadastrar novos usuários.' });
    }

    const { nome_completo, email, senha, tipo, cpf, matricula, curso, periodo } = req.body;

    if (!nome_completo || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Todos os campos (nome_completo, email, senha, tipo) são obrigatórios.' });
    }
    if (tipo === 'professor' && !cpf) {
        return res.status(400).json({ error: 'CPF é obrigatório para o cadastro de professor.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Inicia uma transação

        // SENHA EM TEXTO PURO (ATENÇÃO: INSEGURO PARA PRODUÇÃO!)
        const senhaEmTextoPuro = senha; 
        const usuarioQuery = `INSERT INTO Usuarios (nome_completo, email, senha, tipo) VALUES ($1, $2, $3, $4) RETURNING id, nome_completo, email, tipo;`;
        const novoUsuarioResult = await client.query(usuarioQuery, [nome_completo, email, senhaEmTextoPuro, tipo]);
        const novoUsuario = novoUsuarioResult.rows[0];

        if (tipo === 'professor') {
            const professorQuery = 'INSERT INTO Professores (usuario_id, cpf) VALUES ($1, $2)';
            await client.query(professorQuery, [novoUsuario.id, cpf.replace(/\D/g, '')]);
        } else if (tipo === 'aluno') {
            const matriculaFinal = matricula || `AUTO-${Date.now()}`;
            const cursoFinal = curso || 'Não Definido';
            const periodoFinal = periodo || 1;

            const alunoQuery = 'INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES ($1, $2, $3, $4)';
            await client.query(alunoQuery, [novoUsuario.id, matriculaFinal, cursoFinal, periodoFinal]);
        }

        await client.query('COMMIT'); // Confirma a transação
        res.status(201).json(novoUsuario); // Retorna os dados do novo usuário (sem a senha)
    } catch (error) {
        await client.query('ROLLBACK'); // Desfaz a transação em caso de erro
        if (error.code === '23505') { // Código de erro para violação de chave única (email ou CPF já existem)
            return res.status(409).json({ error: 'Email ou CPF já cadastrado.' });
        }
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    } finally {
        client.release(); // Libera o cliente do pool de conexão
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
    delete usuario.senha; // Remove a senha do objeto antes de enviar a resposta
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
        // Comparação de senha em texto puro
        const senhaCorreta = (senha === usuario.senha);
        if (!senhaCorreta) { return res.status(401).json({ error: 'Senha inválida.' }); }
        const tokenPayload = { id: usuario.id, email: usuario.email, tipo: usuario.tipo };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
        delete usuario.senha; // Remove a senha do objeto antes de enviar a resposta
        res.status(200).json({ message: 'Login de professor realizado com sucesso!', usuario, token });
    } catch (error) {
        console.error('Erro ao fazer login de professor:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
});

/*
================================================================================
  ROTA PROTEGIDA PARA BUSCAR DETALHES DO USUÁRIO POR ID
================================================================================
*/
app.get('/usuarios/:id', verificarTokenEAutorizacao, async (req, res) => {
    const { id } = req.params;

    // Garante que o usuário logado só pode buscar os próprios dados
    // OU, se for professor, pode buscar dados de outros (regra de negócio)
    if (req.usuario.id !== parseInt(id) && req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para ver os dados deste usuário.' });
    }

    const client = await pool.connect();
    try {
        const queryUsuario = `SELECT id, nome_completo, email, tipo FROM Usuarios WHERE id = $1;`;
        const resultUsuario = await client.query(queryUsuario, [id]);
        const usuario = resultUsuario.rows[0];

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        let usuarioDetalhes = { ...usuario }; // Copia os dados básicos

        // Se for aluno, busca dados adicionais da tabela Alunos
        if (usuario.tipo === 'aluno') {
            const queryAluno = `SELECT matricula, curso, periodo FROM Alunos WHERE usuario_id = $1;`;
            const resultAluno = await client.query(queryAluno, [id]);
            if (resultAluno.rows.length > 0) {
                usuarioDetalhes.aluno_info = resultAluno.rows[0];
            }
        }
        // Se for professor, busca dados adicionais da tabela Professores
        else if (usuario.tipo === 'professor') {
            const queryProfessor = `SELECT cpf FROM Professores WHERE usuario_id = $1;`;
            const resultProfessor = await client.query(queryProfessor, [id]);
            if (resultProfessor.rows.length > 0) {
                usuarioDetalhes.professor_info = resultProfessor.rows[0];
            }
        }

        res.status(200).json(usuarioDetalhes);

    } catch (error) {
        console.error('Erro ao buscar detalhes do usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao buscar dados do usuário.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  ROTA PROTEGIDA PARA ALTERAÇÃO DE SENHA
================================================================================
*/
app.post('/alterar-senha', verificarTokenEAutorizacao, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.usuario.id; // ID do usuário logado pelo token

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
    }

    const client = await pool.connect();
    try {
        // 1. Buscar a senha atual do usuário no banco
        const query = 'SELECT senha FROM Usuarios WHERE id = $1';
        const result = await client.query(query, [userId]);
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // 2. Comparar a senha atual fornecida com a senha salva (em texto puro)
        if (currentPassword !== usuario.senha) {
            return res.status(401).json({ error: 'Senha atual incorreta.' });
        }

        // 3. Atualizar a senha (em texto puro) no banco
        const updateQuery = 'UPDATE Usuarios SET senha = $1 WHERE id = $2;';
        await client.query(updateQuery, [newPassword, userId]);

        res.status(200).json({ message: 'Senha alterada com sucesso!' });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao alterar a senha.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  ROTA DE RECUPERAÇÃO DE SENHA
================================================================================
*/
app.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'O campo email é obrigatório.' });
    }

    try {
        const query = 'SELECT * FROM Usuarios WHERE email = $1';
        const result = await pool.query(query, [email]);
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(404).json({ error: 'Email não encontrado no sistema.' });
        }

        console.log(`SIMULAÇÃO: Enviando email de recuperação para ${email}`);
        res.status(200).json({ message: 'Se o email estiver cadastrado, um link de recuperação foi enviado.' });

    } catch (error) {
        console.error('Erro no processo de recuperação de senha:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
});

/*
================================================================================
  NOVAS ROTAS PARA NOTÍCIAS (CRUD)
================================================================================
*/
// Rota para Publicar Notícia (APENAS PROFESSORES)
app.post('/noticias', verificarTokenEAutorizacao, async (req, res) => {
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem publicar notícias.' });
    }

    const { titulo, conteudo, categoria } = req.body;
    const autor_id = req.usuario.id; // O ID do professor que está publicando

    if (!titulo || !conteudo) {
        return res.status(400).json({ error: 'Título e conteúdo da notícia são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        const query = `INSERT INTO Noticias (titulo, conteudo, categoria, autor_id) VALUES ($1, $2, $3, $4) RETURNING *;`;
        const result = await client.query(query, [titulo, conteudo, categoria || 'Geral', autor_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao publicar notícia:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao publicar a notícia.' });
    } finally {
        client.release();
    }
});

// Rota para Listar Notícias (TODOS)
app.get('/noticias', async (req, res) => {
    const client = await pool.connect();
    try {
        // Seleciona notícias e o nome do autor
        const query = `
            SELECT n.id, n.titulo, n.conteudo, n.categoria, n.data_publicacao, u.nome_completo as autor_nome
            FROM Noticias n
            JOIN Usuarios u ON n.autor_id = u.id
            ORDER BY n.data_publicacao DESC;
        `;
        const result = await client.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar notícias:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao buscar notícias.' });
    } finally {
        client.release();
    }
});

/*
================================================================================
  NOVAS ROTAS PARA BOLETINS (APENAS PROFESSORES)
================================================================================
*/
// Rota para buscar boletim de um aluno específico (APENAS PROFESSORES)
app.get('/boletins/aluno/:alunoId', verificarTokenEAutorizacao, async (req, res) => {
    // Apenas professores podem acessar esta rota
    if (req.usuario.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem acessar boletins de alunos.' });
    }

    const { alunoId } = req.params;

    const client = await pool.connect();
    try {
        // Verifica se o aluno existe
        const alunoQuery = 'SELECT u.nome_completo, a.matricula FROM Usuarios u JOIN Alunos a ON u.id = a.usuario_id WHERE a.id = $1 AND u.tipo = \'aluno\';';
        const alunoResult = await client.query(alunoQuery, [alunoId]);
        if (alunoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Aluno não encontrado.' });
        }
        const alunoInfo = alunoResult.rows[0];

        // Busca todas as matrículas e notas do aluno
        const boletimQuery = `
            SELECT
                d.nome as disciplina_nome,
                m.nota1,
                m.nota2,
                m.media_final,
                m.frequencia,
                m.status,
                t.ano,
                t.semestre
            FROM Matriculas m
            JOIN Turmas t ON m.turma_id = t.id
            JOIN Disciplinas d ON t.disciplina_id = d.id
            WHERE m.aluno_id = $1
            ORDER BY t.ano DESC, t.semestre DESC, d.nome ASC;
        `;
        const boletimResult = await client.query(boletimQuery, [alunoId]);

        res.status(200).json({
            aluno: alunoInfo,
            boletim: boletimResult.rows
        });

    } catch (error) {
        console.error('Erro ao buscar boletim do aluno:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao buscar o boletim.' });
    } finally {
        client.release();
    }
});


/*
================================================================================
  ROTA DE RECUPERAÇÃO DE SENHA
================================================================================
*/
app.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'O campo email é obrigatório.' });
    }

    try {
        const query = 'SELECT * FROM Usuarios WHERE email = $1';
        const result = await pool.query(query, [email]);
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(404).json({ error: 'Email não encontrado no sistema.' });
        }

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
