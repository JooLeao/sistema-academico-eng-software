-- Tabela Central de Usuários
CREATE TABLE IF NOT EXISTS Usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('aluno', 'professor')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Professores (SIMPLIFICADA: apenas id, usuario_id, cpf)
CREATE TABLE IF NOT EXISTS Professores (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- Tabela de Alunos
CREATE TABLE IF NOT EXISTS Alunos (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE NOT NULL,
    matricula VARCHAR(20) UNIQUE, -- Matrícula pode ser nula no início, se gerada depois
    curso VARCHAR(100),
    periodo INT,
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- Opcional: Tabelas adicionais
CREATE TABLE IF NOT EXISTS Disciplinas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    carga_horaria INT NOT NULL
);

CREATE TABLE IF NOT EXISTS Turmas (
    id SERIAL PRIMARY KEY,
    disciplina_id INT,
    professor_id INT,
    ano INT NOT NULL,
    semestre INT NOT NULL,
    horario VARCHAR(100),
    FOREIGN KEY (disciplina_id) REFERENCES Disciplinas(id),
    FOREIGN KEY (professor_id) REFERENCES Professores(id)
);

CREATE TABLE IF NOT EXISTS Matriculas (
    id SERIAL PRIMARY KEY,
    aluno_id INT NOT NULL,
    turma_id INT NOT NULL,
    nota1 FLOAT,
    nota2 FLOAT,
    media_final FLOAT,
    frequencia FLOAT,
    status VARCHAR(20) DEFAULT 'cursando' CHECK (status IN ('cursando', 'aprovado', 'reprovado')),
    FOREIGN KEY (aluno_id) REFERENCES Alunos(id),
    FOREIGN KEY (turma_id) REFERENCES Turmas(id),
    UNIQUE(aluno_id, turma_id)
);

-- NOVA TABELA: Noticias (Para o Professor Publicar)
CREATE TABLE IF NOT EXISTS Noticias (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    categoria VARCHAR(100),
    data_publicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    autor_id INT NOT NULL, -- ID do professor que publicou
    FOREIGN KEY (autor_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);


-- =============================================================================
-- INSERÇÃO DE DADOS INICIAIS (COM SENHAS EM TEXTO PURO PARA TESTE)
-- Lembre-se: Isso não é seguro para sistemas reais!
-- As senhas para testes são:
-- Alunos: aluno[1-5]@discente.ifpe.edu.br | Senhas: 12345, 123456, 123457, 123458, 123459
-- Professores: professor[1-5]@docente.ifpe.edu.br | Senhas: p12345, p123456, p123457, p123458, p123459
-- =============================================================================

-- Usuários Alunos
INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno1@discente.ifpe.edu.br', '12345', 'João Silva', 'aluno') ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES
((SELECT id FROM Usuarios WHERE email = 'aluno1@discente.ifpe.edu.br'), '2023001', 'Engenharia de Software', 3) ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno2@discente.ifpe.edu.br', '123456', 'Maria Oliveira', 'aluno') ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES
((SELECT id FROM Usuarios WHERE email = 'aluno2@discente.ifpe.edu.br'), '2023002', 'Engenharia de Software', 3) ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno3@discente.ifpe.edu.br', '123457', 'Pedro Souza', 'aluno') ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES
((SELECT id FROM Usuarios WHERE email = 'aluno3@discente.ifpe.edu.br'), '2023003', 'Engenharia de Software', 3) ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno4@discente.ifpe.edu.br', '123458', 'Ana Santos', 'aluno') ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES
((SELECT id FROM Usuarios WHERE email = 'aluno4@discente.ifpe.edu.br'), '2023004', 'Engenharia de Software', 3) ON CONFLICT (matricula) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno5@discente.ifpe.edu.br', '123459', 'Lucas Pereira', 'aluno') ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo) VALUES
((SELECT id FROM Usuarios WHERE email = 'aluno5@discente.ifpe.edu.br'), '2023005', 'Engenharia de Software', 3) ON CONFLICT (matricula) DO NOTHING;


-- Usuários Professores
INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor1@docente.ifpe.edu.br', 'p12345', 'Carlos Lima', 'professor') ON CONFLICT (email) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf) VALUES
((SELECT id FROM Usuarios WHERE email = 'professor1@docente.ifpe.edu.br'), '11122233301') ON CONFLICT (cpf) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor2@docente.ifpe.edu.br', 'p123456', 'Beatriz Costa', 'professor') ON CONFLICT (email) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf) VALUES
((SELECT id FROM Usuarios WHERE email = 'professor2@docente.ifpe.edu.br'), '11122233302') ON CONFLICT (cpf) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor3@docente.ifpe.edu.br', 'p123457', 'Fernando Rocha', 'professor') ON CONFLICT (email) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf) VALUES
((SELECT id FROM Usuarios WHERE email = 'professor3@docente.ifpe.edu.br'), '11122233303') ON CONFLICT (cpf) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor4@docente.ifpe.edu.br', 'p123458', 'Gabriela Alves', 'professor') ON CONFLICT (email) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf) VALUES
((SELECT id FROM Usuarios WHERE email = 'professor4@docente.ifpe.edu.br'), '11122233304') ON CONFLICT (cpf) DO NOTHING;

INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor5@docente.ifpe.edu.br', 'p123459', 'Ricardo Gomes', 'professor') ON CONFLICT (email) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf) VALUES
((SELECT id FROM Usuarios WHERE email = 'professor5@docente.ifpe.edu.br'), '11122233305') ON CONFLICT (cpf) DO NOTHING;
