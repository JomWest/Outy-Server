-- =================================================================
--      SCRIPT COMPLETO DE BASE DE DATOS PARA BOLSA DE TRABAJO
--      Contexto: Aplicación para buscar y ofrecer empleo en Nicaragua
--      Motor: SQL Server
-- =================================================================

-- ========= SECCIÓN 1: ESTRUCTURA CENTRAL DE USUARIOS Y ROLES =========

-- Tabla de Usuarios: El punto de entrada, define el rol principal.
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    -- Rol clave que define el tipo de usuario y su perfil asociado
    role NVARCHAR(20) NOT NULL CHECK (role IN ('candidato', 'empleador')),
    phone_number NVARCHAR(20) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- Perfil de la Empresa/Empleador (ligado 1-a-1 con users)
CREATE TABLE company_profiles (
    user_id UNIQUEIDENTIFIER PRIMARY KEY, -- Llave Primaria y Foránea
    company_name NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NULL,
    industry NVARCHAR(100) NULL,
    website_url NVARCHAR(255) NULL,
    logo_url NVARCHAR(MAX) NULL,
    address NVARCHAR(255) NULL,
    -- Relación
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Perfil del Candidato (ligado 1-a-1 con users)
CREATE TABLE candidate_profiles (
    user_id UNIQUEIDENTIFIER PRIMARY KEY, -- Llave Primaria y Foránea
    full_name NVARCHAR(150) NOT NULL,
    professional_title NVARCHAR(150) NULL, -- Ej: "Desarrollador Full-Stack"
    bio NVARCHAR(MAX) NULL,
    profile_picture_url NVARCHAR(MAX) NULL,
    resume_url NVARCHAR(MAX) NULL, -- URL a un PDF en la nube
    -- Relación
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- ========= SECCIÓN 2: DATOS DE SOPORTE Y CATEGORIZACIÓN =========

-- Ubicaciones de Nicaragua para estandarizar las ofertas
CREATE TABLE locations_nicaragua (
    id INT IDENTITY(1,1) PRIMARY KEY,
    department NVARCHAR(100) NOT NULL, -- Departamento
    municipality NVARCHAR(100) NOT NULL -- Municipio
);
GO

-- Categorías de trabajo (Tecnología, Ventas, etc.)
CREATE TABLE job_categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);
GO

-- Habilidades que los candidatos pueden tener y los trabajos requerir
CREATE TABLE skills (
    id INT IDENTITY(1,1) PRIMARY KEY,
    skill_name NVARCHAR(100) NOT NULL UNIQUE
);
GO

-- ========= SECCIÓN 3: ESTRUCTURA DEL CURRÍCULUM DEL CANDIDATO =========

-- Experiencia laboral de un candidato
CREATE TABLE work_experience (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    candidate_id UNIQUEIDENTIFIER NOT NULL,
    job_title NVARCHAR(150) NOT NULL,
    company_name NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL, -- Nulo si es el trabajo actual
    -- Relación
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(user_id) ON DELETE CASCADE
);
GO

-- Educación de un candidato
CREATE TABLE education (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    candidate_id UNIQUEIDENTIFIER NOT NULL,
    institution_name NVARCHAR(150) NOT NULL,
    degree NVARCHAR(150) NOT NULL, -- Ej: "Ingeniería en Sistemas"
    field_of_study NVARCHAR(150) NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    -- Relación
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(user_id) ON DELETE CASCADE
);
GO

-- Tabla pivote para las habilidades de un candidato (Muchos a Muchos)
CREATE TABLE candidate_skills (
    candidate_id UNIQUEIDENTIFIER NOT NULL,
    skill_id INT NOT NULL,
    PRIMARY KEY (candidate_id, skill_id),
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
GO

-- ========= SECCIÓN 4: NÚCLEO DE LA BOLSA DE TRABAJO (OFERTAS Y POSTULACIONES) =========

-- Tabla de ofertas de trabajo
CREATE TABLE jobs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL, -- El 'user_id' del empleador
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    requirements NVARCHAR(MAX) NULL,
    job_category_id INT NULL,
    location_id INT NULL,
    employment_type NVARCHAR(50) CHECK (employment_type IN ('tiempo_completo', 'medio_tiempo', 'contrato', 'pasantia')),
    salary_min DECIMAL(10, 2) NULL,
    salary_max DECIMAL(10, 2) NULL,
    salary_currency NVARCHAR(5) DEFAULT 'NIO', -- NIO o USD
    status NVARCHAR(20) NOT NULL CHECK (status IN ('abierta', 'cerrada', 'pausada')) DEFAULT 'abierta',
    expires_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    -- Relaciones
    FOREIGN KEY (company_id) REFERENCES company_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY (job_category_id) REFERENCES job_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations_nicaragua(id) ON DELETE SET NULL
);
GO

-- Tabla de postulaciones (un candidato se postula a un trabajo)
CREATE TABLE job_applications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    job_id UNIQUEIDENTIFIER NOT NULL,
    candidate_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(20) NOT NULL CHECK (status IN ('enviada', 'vista', 'en_proceso', 'rechazada', 'aceptada')) DEFAULT 'enviada',
    cover_letter NVARCHAR(MAX) NULL,
    applied_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    -- Relaciones
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(user_id) ON DELETE NO ACTION -- No borrar si el candidato borra su perfil
);
GO

-- ========= SECCIÓN 5: RESEÑAS Y CHATS =========

-- Tabla de reseñas (bidireccional, basada en una postulación)
CREATE TABLE reviews (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    job_application_id UNIQUEIDENTIFIER NOT NULL UNIQUE, -- Una reseña por postulación
    -- Quién hace la reseña
    author_id UNIQUEIDENTIFIER NOT NULL,
    author_role NVARCHAR(20) NOT NULL,
    -- A quién se le hace la reseña
    subject_id UNIQUEIDENTIFIER NOT NULL,
    subject_role NVARCHAR(20) NOT NULL,
    -- Contenido de la reseña
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    -- Relaciones
    FOREIGN KEY (job_application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE NO ACTION,
    FOREIGN KEY (subject_id) REFERENCES users(id) ON DELETE NO ACTION
);
GO

-- El sistema de chat se puede vincular a una postulación
CREATE TABLE conversations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    job_application_id UNIQUEIDENTIFIER NULL, -- Vínculo opcional al proceso
    last_message_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (job_application_id) REFERENCES job_applications(id) ON DELETE SET NULL
);
GO

CREATE TABLE conversation_participants (
    user_id UNIQUEIDENTIFIER NOT NULL,
    conversation_id UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (user_id, conversation_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
GO

CREATE TABLE messages (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    conversation_id UNIQUEIDENTIFIER NOT NULL,
    sender_id UNIQUEIDENTIFIER NOT NULL,
    message_text NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE NO ACTION
);
GO

-- ========= SECCIÓN 6: DATOS INICIALES (SEMILLAS) =========

INSERT INTO job_categories (name) VALUES ('Tecnología y Desarrollo'), ('Ventas y Marketing'), ('Administración y Oficina'), ('Salud y Medicina'), ('Educación'), ('Restaurantes y Hotelería');
GO
INSERT INTO locations_nicaragua (department, municipality) VALUES
('Managua', 'Managua'), ('Managua', 'Ciudad Sandino'), ('Managua', 'Ticuantepe'),
('León', 'León'), ('León', 'Nagarote'),
('Granada', 'Granada'),
('Masaya', 'Masaya'), ('Masaya', 'Nindiri'),
('Estelí', 'Estelí');
GO
INSERT INTO skills (skill_name) VALUES ('SQL Server'), ('Desarrollo Web'), ('Atención al Cliente'), ('Microsoft Office'), ('Contabilidad'), ('Inglés Avanzado');
GO

PRINT '¡Base de datos para Bolsa de Trabajo creada exitosamente!';