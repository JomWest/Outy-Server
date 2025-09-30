-- =================================================================
--      MIGRACIÓN: SISTEMA DE TRABAJADORES Y TRABAJOS EXPRÉS
--      Contexto: Extensión para oficios comunes en Nicaragua
--      Fecha: 2025
-- =================================================================

-- ========= SECCIÓN 1: CATEGORÍAS DE OFICIOS =========

-- Categorías específicas para oficios comunes en Nicaragua
CREATE TABLE trade_categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(255) NULL,
    icon_name NVARCHAR(50) NULL -- Para iconos en la app móvil
);
GO

-- Insertar categorías de oficios comunes
INSERT INTO trade_categories (name, description, icon_name) VALUES
('Construcción', 'Albañiles, electricistas, plomeros, pintores', 'hammer'),
('Textil y Confección', 'Sastres, costureras, bordadoras', 'scissors'),
('Mecánica y Reparaciones', 'Mecánicos, soldadores, reparadores', 'wrench'),
('Servicios del Hogar', 'Limpieza, jardinería, cuidado', 'home'),
('Gastronomía', 'Cocineros, panaderos, reposteros', 'chef-hat'),
('Belleza y Cuidado Personal', 'Peluqueros, barberos, esteticistas', 'cut'),
('Transporte', 'Conductores, mensajeros, delivery', 'truck'),
('Agricultura', 'Trabajadores agrícolas, jardineros', 'leaf'),
('Artesanías', 'Carpinteros, ceramistas, artesanos', 'palette'),
('Servicios Técnicos', 'Técnicos en electrodomésticos, computadoras', 'settings');
GO

-- ========= SECCIÓN 2: PERFILES DE TRABAJADORES =========

-- Perfil específico para trabajadores de oficios
CREATE TABLE worker_profiles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL UNIQUE, -- Relación con users
    full_name NVARCHAR(150) NOT NULL,
    trade_category_id INT NOT NULL,
    specialty NVARCHAR(150) NOT NULL, -- Ej: "Albañil especializado en acabados"
    years_experience INT NOT NULL DEFAULT 0,
    description NVARCHAR(MAX) NULL,
    profile_picture_url NVARCHAR(MAX) NULL,
    
    -- Información de contacto y ubicación
    phone_number NVARCHAR(20) NOT NULL,
    whatsapp_number NVARCHAR(20) NULL,
    location_id INT NULL,
    address_details NVARCHAR(255) NULL,
    
    -- Disponibilidad y precios
    available BIT NOT NULL DEFAULT 1,
    hourly_rate_min DECIMAL(8, 2) NULL,
    hourly_rate_max DECIMAL(8, 2) NULL,
    daily_rate_min DECIMAL(8, 2) NULL,
    daily_rate_max DECIMAL(8, 2) NULL,
    currency NVARCHAR(5) DEFAULT 'NIO',
    
    -- Calificaciones y verificación
    average_rating DECIMAL(3, 2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    verified BIT DEFAULT 0,
    verification_date DATETIME2 NULL,
    
    -- Metadatos
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Relaciones
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trade_category_id) REFERENCES trade_categories(id) ON DELETE NO ACTION,
    FOREIGN KEY (location_id) REFERENCES locations_nicaragua(id) ON DELETE SET NULL
);
GO

-- ========= SECCIÓN 3: HABILIDADES Y SERVICIOS ESPECÍFICOS =========

-- Servicios específicos que puede ofrecer un trabajador
CREATE TABLE worker_services (
    id INT IDENTITY(1,1) PRIMARY KEY,
    trade_category_id INT NOT NULL,
    service_name NVARCHAR(150) NOT NULL,
    description NVARCHAR(255) NULL,
    
    FOREIGN KEY (trade_category_id) REFERENCES trade_categories(id) ON DELETE CASCADE
);
GO

-- Relación muchos a muchos: trabajador - servicios
CREATE TABLE worker_service_offerings (
    worker_id UNIQUEIDENTIFIER NOT NULL,
    service_id INT NOT NULL,
    price_min DECIMAL(8, 2) NULL,
    price_max DECIMAL(8, 2) NULL,
    
    PRIMARY KEY (worker_id, service_id),
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES worker_services(id) ON DELETE CASCADE
);
GO

-- ========= SECCIÓN 4: TRABAJOS EXPRÉS =========

-- Solicitudes de trabajo exprés
CREATE TABLE express_jobs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    client_id UNIQUEIDENTIFIER NOT NULL, -- Usuario que solicita
    trade_category_id INT NOT NULL,
    
    -- Detalles del trabajo
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    location_id INT NULL,
    address_details NVARCHAR(255) NULL,
    
    -- Urgencia y tiempo
    urgency NVARCHAR(20) NOT NULL CHECK (urgency IN ('inmediato', 'hoy', 'esta_semana', 'flexible')) DEFAULT 'flexible',
    preferred_date DATETIME2 NULL,
    estimated_duration NVARCHAR(50) NULL, -- Ej: "2-3 horas", "1 día"
    
    -- Presupuesto
    budget_min DECIMAL(10, 2) NULL,
    budget_max DECIMAL(10, 2) NULL,
    currency NVARCHAR(5) DEFAULT 'NIO',
    payment_method NVARCHAR(50) NULL, -- Ej: "efectivo", "transferencia"
    
    -- Estado y metadatos
    status NVARCHAR(20) NOT NULL CHECK (status IN ('abierto', 'en_proceso', 'completado', 'cancelado')) DEFAULT 'abierto',
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    expires_at DATETIME2 NULL,
    
    -- Relaciones
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trade_category_id) REFERENCES trade_categories(id) ON DELETE NO ACTION,
    FOREIGN KEY (location_id) REFERENCES locations_nicaragua(id) ON DELETE SET NULL
);
GO

-- ========= SECCIÓN 5: POSTULACIONES A TRABAJOS EXPRÉS =========

-- Postulaciones de trabajadores a trabajos exprés
CREATE TABLE express_job_applications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    express_job_id UNIQUEIDENTIFIER NOT NULL,
    worker_id UNIQUEIDENTIFIER NOT NULL,
    
    -- Propuesta del trabajador
    proposed_price DECIMAL(10, 2) NOT NULL,
    estimated_time NVARCHAR(100) NULL,
    message NVARCHAR(MAX) NULL,
    
    -- Estado
    status NVARCHAR(20) NOT NULL CHECK (status IN ('enviada', 'vista', 'aceptada', 'rechazada', 'retirada')) DEFAULT 'enviada',
    
    -- Metadatos
    applied_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Relaciones
    FOREIGN KEY (express_job_id) REFERENCES express_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE,
    
    -- Un trabajador solo puede postularse una vez por trabajo
    UNIQUE (express_job_id, worker_id)
);
GO

-- ========= SECCIÓN 6: SISTEMA DE CALIFICACIONES PARA TRABAJADORES =========

-- Calificaciones específicas para trabajadores
CREATE TABLE worker_reviews (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    worker_id UNIQUEIDENTIFIER NOT NULL,
    client_id UNIQUEIDENTIFIER NOT NULL,
    express_job_id UNIQUEIDENTIFIER NULL, -- Opcional, puede ser por trabajo específico
    
    -- Calificación detallada
    overall_rating INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
    punctuality_rating INT CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
    
    -- Comentarios
    comment NVARCHAR(MAX) NULL,
    would_recommend BIT DEFAULT 1,
    
    -- Metadatos
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Relaciones
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE NO ACTION,
    FOREIGN KEY (express_job_id) REFERENCES express_jobs(id) ON DELETE SET NULL
);
GO

-- ========= SECCIÓN 7: PORTAFOLIO DE TRABAJADORES =========

-- Galería de trabajos realizados por trabajadores
CREATE TABLE worker_portfolio (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    worker_id UNIQUEIDENTIFIER NOT NULL,
    
    -- Información del proyecto
    project_title NVARCHAR(200) NOT NULL,
    project_description NVARCHAR(MAX) NULL,
    completion_date DATE NULL,
    
    -- Medios
    image_url NVARCHAR(MAX) NULL,
    before_image_url NVARCHAR(MAX) NULL, -- Foto antes del trabajo
    after_image_url NVARCHAR(MAX) NULL,  -- Foto después del trabajo
    
    -- Metadatos
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    is_featured BIT DEFAULT 0, -- Para destacar trabajos principales
    
    -- Relaciones
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
);
GO

-- ========= SECCIÓN 8: DATOS INICIALES PARA SERVICIOS =========

-- Servicios para Construcción
INSERT INTO worker_services (trade_category_id, service_name, description) VALUES
(1, 'Construcción de paredes', 'Levantado de paredes con bloque o ladrillo'),
(1, 'Acabados y repello', 'Repello fino y grueso, acabados decorativos'),
(1, 'Instalación de pisos', 'Cerámica, porcelanato, laminado'),
(1, 'Pintura interior y exterior', 'Pintura de casas, oficinas y locales'),
(1, 'Instalaciones eléctricas', 'Cableado, tomas, interruptores'),
(1, 'Plomería básica', 'Instalación y reparación de tuberías'),
(1, 'Techos y cubiertas', 'Instalación de zinc, tejas, estructura');
GO

-- Servicios para Textil y Confección
INSERT INTO worker_services (trade_category_id, service_name, description) VALUES
(2, 'Confección de ropa', 'Vestidos, camisas, pantalones a medida'),
(2, 'Arreglos de ropa', 'Ajustes, dobladillos, reparaciones'),
(2, 'Bordados y decoraciones', 'Bordados a mano y máquina'),
(2, 'Uniformes empresariales', 'Confección de uniformes para empresas'),
(2, 'Ropa de niños', 'Especialidad en ropa infantil'),
(2, 'Cortinas y tapicería', 'Confección de cortinas y forros');
GO

-- Servicios para Mecánica
INSERT INTO worker_services (trade_category_id, service_name, description) VALUES
(3, 'Reparación de motores', 'Motores de carros y motocicletas'),
(3, 'Soldadura general', 'Soldadura eléctrica y autógena'),
(3, 'Reparación de electrodomésticos', 'Refrigeradoras, lavadoras, etc.'),
(3, 'Mantenimiento de aires acondicionados', 'Limpieza y reparación de A/C'),
(3, 'Reparación de bicicletas', 'Mantenimiento y reparación completa');
GO

-- Servicios del Hogar
INSERT INTO worker_services (trade_category_id, service_name, description) VALUES
(4, 'Limpieza profunda', 'Limpieza completa de casas y oficinas'),
(4, 'Jardinería y poda', 'Mantenimiento de jardines y plantas'),
(4, 'Cuidado de personas mayores', 'Acompañamiento y cuidados básicos'),
(4, 'Limpieza de ventanas', 'Limpieza de cristales y ventanales'),
(4, 'Organización de espacios', 'Organización y decoración de interiores');
GO

PRINT '¡Migración de trabajadores y trabajos exprés completada exitosamente!';