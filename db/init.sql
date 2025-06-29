-- Tabela Central de Usuários
CREATE TABLE IF NOT EXISTS Usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('aluno', 'professor')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Professores
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
    matricula VARCHAR(20) UNIQUE,
    curso VARCHAR(100),
    periodo INT,
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- Tabela de Disciplinas
CREATE TABLE IF NOT EXISTS Disciplinas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    carga_horaria INT NOT NULL
);

-- Tabela de Turmas
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

-- Tabela de Matrículas
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

-- Tabela de Notícias
CREATE TABLE IF NOT EXISTS Noticias (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    categoria VARCHAR(100),
    data_publicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    autor_id INT NOT NULL,
    FOREIGN KEY (autor_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- =============================================================================
-- INSERÇÃO DE DADOS INICIAIS (USUÁRIOS)
-- =============================================================================
INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('aluno1@discente.ifpe.edu.br', '12345', 'João Silva', 'aluno'),
('aluno2@discente.ifpe.edu.br', '123456', 'Maria Oliveira', 'aluno'),
('aluno3@discente.ifpe.edu.br', '123457', 'Pedro Souza', 'aluno'),
('aluno4@discente.ifpe.edu.br', '123458', 'Ana Santos', 'aluno'),
('aluno5@discente.ifpe.edu.br', '123459', 'Lucas Pereira', 'aluno')
ON CONFLICT (email) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo)
SELECT id, '2023001', 'Engenharia de Software', 3 FROM Usuarios WHERE email = 'aluno1@discente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo)
SELECT id, '2023002', 'Engenharia de Software', 3 FROM Usuarios WHERE email = 'aluno2@discente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo)
SELECT id, '2023003', 'Engenharia de Software', 3 FROM Usuarios WHERE email = 'aluno3@discente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo)
SELECT id, '2023004', 'Engenharia de Software', 3 FROM Usuarios WHERE email = 'aluno4@discente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO Alunos (usuario_id, matricula, curso, periodo)
SELECT id, '2023005', 'Engenharia de Software', 3 FROM Usuarios WHERE email = 'aluno5@discente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;

-- CORRIGIDO: Usando a coluna "email" corretamente
INSERT INTO Usuarios (email, senha, nome_completo, tipo) VALUES
('professor1@docente.ifpe.edu.br', 'p12345', 'Carlos Lima', 'professor'),
('professor2@docente.ifpe.edu.br', 'p123456', 'Beatriz Costa', 'professor')
ON CONFLICT (email) DO NOTHING;

-- CORRIGIDO: Usando a coluna "email" corretamente
INSERT INTO Professores (usuario_id, cpf)
SELECT id, '11122233301' FROM Usuarios WHERE email = 'professor1@docente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO Professores (usuario_id, cpf)
SELECT id, '11122233302' FROM Usuarios WHERE email = 'professor2@docente.ifpe.edu.br' ON CONFLICT (usuario_id) DO NOTHING;

-- =============================================================================
-- DADOS PARA DISCIPLINAS, TURMAS E MATRÍCULAS
-- =============================================================================
INSERT INTO Disciplinas (codigo, nome, carga_horaria) VALUES
('ES001', 'Engenharia de Software', 60),
('BD001', 'Banco de Dados I', 60),
('POO01', 'Programação Orientada a Objetos', 60)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO Turmas (disciplina_id, professor_id, ano, semestre, horario) VALUES
( (SELECT id FROM Disciplinas WHERE codigo = 'ES001'), (SELECT id FROM Professores WHERE cpf = '11122233301'), 2025, 1, 'SEG/QUA 14:00-16:00' ),
( (SELECT id FROM Disciplinas WHERE codigo = 'BD001'), (SELECT id FROM Professores WHERE cpf = '11122233301'), 2025, 1, 'TER/QUI 10:00-12:00' ),
( (SELECT id FROM Disciplinas WHERE codigo = 'POO01'), (SELECT id FROM Professores WHERE cpf = '11122233302'), 2025, 1, 'SEG/QUA 10:00-12:00' )
ON CONFLICT DO NOTHING;

INSERT INTO Matriculas (aluno_id, turma_id, nota1, nota2, media_final, frequencia, status) VALUES
( (SELECT id FROM Alunos WHERE matricula = '2023001'), (SELECT id FROM Turmas WHERE disciplina_id = (SELECT id FROM Disciplinas WHERE codigo = 'ES001')), 5.0, 4.0, 4.5, 70.0, 'reprovado' ),
( (SELECT id FROM Alunos WHERE matricula = '2023002'), (SELECT id FROM Turmas WHERE disciplina_id = (SELECT id FROM Disciplinas WHERE codigo = 'ES001')), 9.0, 9.5, 9.25, 100.0, 'aprovado' ),
( (SELECT id FROM Alunos WHERE matricula = '2023003'), (SELECT id FROM Turmas WHERE disciplina_id = (SELECT id FROM Disciplinas WHERE codigo = 'BD001')), 7.0, null, null, 100.0, 'cursando' ),
( (SELECT id FROM Alunos WHERE matricula = '2023004'), (SELECT id FROM Turmas WHERE disciplina_id = (SELECT id FROM Disciplinas WHERE codigo = 'BD001')), 8.0, 7.5, 7.75, 95.0, 'aprovado' ),
( (SELECT id FROM Alunos WHERE matricula = '2023005'), (SELECT id FROM Turmas WHERE disciplina_id = (SELECT id FROM Disciplinas WHERE codigo = 'ES001')), 6.0, 8.0, 7.0, 88.0, 'aprovado' )
ON CONFLICT (aluno_id, turma_id) DO NOTHING;