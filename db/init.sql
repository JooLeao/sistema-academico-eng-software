-- Tabela Central de Usuários
CREATE TABLE Usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('aluno', 'professor')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Professores
CREATE TABLE Professores (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE NOT NULL,
    departamento VARCHAR(100),
    especialidade VARCHAR(100),
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- Tabela de Alunos
CREATE TABLE Alunos (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE NOT NULL,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    curso VARCHAR(100),
    periodo INT,
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id) ON DELETE CASCADE
);

-- Tabela de Disciplinas
CREATE TABLE Disciplinas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    carga_horaria INT NOT NULL
);

-- Tabela de Turmas
CREATE TABLE Turmas (
    id SERIAL PRIMARY KEY,
    disciplina_id INT NOT NULL,
    professor_id INT NOT NULL,
    ano INT NOT NULL,
    semestre INT NOT NULL,
    horario VARCHAR(100),
    FOREIGN KEY (disciplina_id) REFERENCES Disciplinas(id),
    FOREIGN KEY (professor_id) REFERENCES Professores(id)
);

-- Tabela de Matrículas
CREATE TABLE Matriculas (
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