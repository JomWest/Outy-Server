-- ========= DATOS DE PRUEBA PARA OUTY =========
-- Este archivo contiene datos de prueba representativos para verificar el funcionamiento del sistema

USE outy_db;
GO

-- ========= USUARIOS DE PRUEBA =========
-- Contraseña para todos: "123456" (ya hasheada)
INSERT INTO users (email, password_hash, user_type, is_active, created_at) VALUES
('empresa1@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'company', 1, GETDATE()),
('empresa2@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'company', 1, GETDATE()),
('empresa3@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'company', 1, GETDATE()),
('candidato1@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'candidate', 1, GETDATE()),
('candidato2@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'candidate', 1, GETDATE()),
('candidato3@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'candidate', 1, GETDATE());
GO

-- ========= PERFILES DE EMPRESAS =========
INSERT INTO company_profiles (user_id, company_name, industry, company_size, description, website, phone, location_id, created_at) VALUES
(1, 'TechNova Solutions', 'Tecnología', '50-100', 'Empresa líder en desarrollo de software y soluciones tecnológicas innovadoras para empresas.', 'www.technova.com', '2555-1234', 1, GETDATE()),
(2, 'Marketing Pro', 'Marketing Digital', '10-50', 'Agencia especializada en marketing digital, redes sociales y publicidad online.', 'www.marketingpro.com', '2555-5678', 1, GETDATE()),
(3, 'Salud Integral', 'Salud', '100-500', 'Centro médico integral con servicios de medicina general, especialidades y laboratorio clínico.', 'www.saludintegral.com', '2555-9012', 2, GETDATE());
GO

-- ========= PERFILES DE CANDIDATOS =========
INSERT INTO candidate_profiles (user_id, first_name, last_name, phone, date_of_birth, location_id, professional_summary, created_at) VALUES
(4, 'María', 'González', '8888-1234', '1995-03-15', 1, 'Desarrolladora web con 3 años de experiencia en React y Node.js. Apasionada por crear soluciones innovadoras.', GETDATE()),
(5, 'Carlos', 'Rodríguez', '8888-5678', '1992-07-22', 1, 'Especialista en marketing digital con experiencia en redes sociales y campañas publicitarias.', GETDATE()),
(6, 'Ana', 'López', '8888-9012', '1990-11-08', 3, 'Enfermera profesional con 5 años de experiencia en cuidados intensivos y atención al paciente.', GETDATE());
GO

-- ========= TRABAJOS DE PRUEBA =========
INSERT INTO jobs (company_id, title, description, requirements, job_category_id, location_id, employment_type, salary_min, salary_max, salary_currency, status, expires_at, created_at) VALUES
(1, 'Desarrollador Frontend React', 
'Buscamos un desarrollador frontend con experiencia en React para unirse a nuestro equipo de desarrollo. Trabajarás en proyectos innovadores y tendrás oportunidades de crecimiento profesional.',
'- 2+ años de experiencia con React
- Conocimientos en JavaScript ES6+
- Experiencia con CSS3 y HTML5
- Conocimientos en Git
- Inglés básico', 
1, 1, 'full-time', 25000, 35000, 'NIO', 'active', DATEADD(month, 2, GETDATE()), GETDATE()),

(1, 'Desarrollador Backend Node.js', 
'Únete a nuestro equipo como desarrollador backend. Trabajarás con tecnologías modernas y participarás en el desarrollo de APIs robustas y escalables.',
'- 3+ años de experiencia con Node.js
- Conocimientos en bases de datos SQL
- Experiencia con APIs REST
- Conocimientos en Docker (deseable)
- Trabajo en equipo', 
1, 1, 'full-time', 30000, 40000, 'NIO', 'active', DATEADD(month, 2, GETDATE()), GETDATE()),

(2, 'Especialista en Marketing Digital', 
'Buscamos un especialista en marketing digital para gestionar nuestras campañas publicitarias y estrategias de redes sociales.',
'- 2+ años de experiencia en marketing digital
- Conocimientos en Google Ads y Facebook Ads
- Experiencia en redes sociales
- Creatividad y pensamiento analítico
- Excelente comunicación', 
2, 1, 'full-time', 20000, 28000, 'NIO', 'active', DATEADD(month, 1, GETDATE()), GETDATE()),

(2, 'Community Manager', 
'Estamos buscando un community manager creativo para gestionar nuestras redes sociales y crear contenido atractivo.',
'- 1+ años de experiencia en redes sociales
- Creatividad para crear contenido
- Conocimientos en diseño básico
- Excelente redacción
- Disponibilidad de horarios', 
2, 1, 'part-time', 15000, 20000, 'NIO', 'active', DATEADD(month, 1, GETDATE()), GETDATE()),

(3, 'Enfermera/o Profesional', 
'Buscamos enfermera/o profesional para unirse a nuestro equipo médico. Ofrecemos un ambiente de trabajo profesional y oportunidades de desarrollo.',
'- Título de enfermería
- Licencia vigente
- 2+ años de experiencia
- Excelente trato al paciente
- Disponibilidad de turnos', 
4, 2, 'full-time', 18000, 25000, 'NIO', 'active', DATEADD(month, 3, GETDATE()), GETDATE()),

(3, 'Recepcionista Médica', 
'Necesitamos recepcionista para atención al cliente en nuestro centro médico. Persona responsable y con excelente atención al cliente.',
'- Bachillerato completo
- Experiencia en atención al cliente
- Conocimientos básicos de computación
- Excelente comunicación
- Responsabilidad y puntualidad', 
3, 2, 'full-time', 12000, 16000, 'NIO', 'active', DATEADD(month, 1, GETDATE()), GETDATE());
GO

-- ========= APLICACIONES DE PRUEBA =========
INSERT INTO job_applications (job_id, candidate_id, status, cover_letter, applied_at) VALUES
(1, 1, 'pending', 'Estimados, me interesa mucho esta posición ya que tengo experiencia trabajando con React y me gustaría formar parte de su equipo innovador.', GETDATE()),
(3, 2, 'pending', 'Hola, soy especialista en marketing digital con experiencia en campañas exitosas. Me encantaría contribuir al crecimiento de su empresa.', GETDATE()),
(5, 3, 'pending', 'Buenos días, soy enfermera profesional con amplia experiencia en cuidados intensivos. Estoy muy interesada en esta oportunidad.', GETDATE());
GO

PRINT 'Datos de prueba insertados exitosamente!';
PRINT 'Usuarios creados:';
PRINT '- 3 empresas: empresa1@test.com, empresa2@test.com, empresa3@test.com';
PRINT '- 3 candidatos: candidato1@test.com, candidato2@test.com, candidato3@test.com';
PRINT 'Contraseña para todos: 123456';
PRINT '6 trabajos activos creados';
PRINT '3 aplicaciones de prueba creadas';