-- Migración para modificar candidate_profiles para almacenar archivos como BLOB
-- Fecha: 2025-01-29
-- Descripción: Cambiar de URLs a almacenamiento directo de archivos en base de datos

USE [OutyV1];
GO

-- Agregar nuevas columnas para almacenar archivos como BLOB
ALTER TABLE candidate_profiles 
ADD 
    profile_picture_data VARBINARY(MAX) NULL,
    profile_picture_filename NVARCHAR(255) NULL,
    profile_picture_content_type NVARCHAR(100) NULL,
    resume_data VARBINARY(MAX) NULL,
    resume_filename NVARCHAR(255) NULL,
    resume_content_type NVARCHAR(100) NULL;
GO

-- Crear índices para mejorar el rendimiento
CREATE INDEX IX_candidate_profiles_profile_picture_filename 
ON candidate_profiles(profile_picture_filename);

CREATE INDEX IX_candidate_profiles_resume_filename 
ON candidate_profiles(resume_filename);
GO

-- Comentarios para documentar los nuevos campos
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Datos binarios de la imagen de perfil',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'profile_picture_data';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Nombre original del archivo de imagen de perfil',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'profile_picture_filename';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Tipo MIME de la imagen de perfil (image/jpeg, image/png)',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'profile_picture_content_type';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Datos binarios del CV/Resume',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'resume_data';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Nombre original del archivo de CV/Resume',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'resume_filename';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Tipo MIME del CV (application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document)',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'candidate_profiles',
    @level2type = N'COLUMN', @level2name = N'resume_content_type';
GO

PRINT 'Migración completada: candidate_profiles ahora puede almacenar archivos como BLOB';