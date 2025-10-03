-- Migración para agregar campos de redes sociales y ubicación a candidate_profiles
-- Fecha: 2025-10-02
-- Descripción: Agregar website, linkedin, instagram, tiktok, skills, city, country

USE [OutyV1];
GO

-- Agregar columnas si no existen
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'website')
BEGIN
    ALTER TABLE candidate_profiles ADD website NVARCHAR(255) NULL;
    PRINT 'Columna website agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'linkedin')
BEGIN
    ALTER TABLE candidate_profiles ADD linkedin NVARCHAR(255) NULL;
    PRINT 'Columna linkedin agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'instagram')
BEGIN
    ALTER TABLE candidate_profiles ADD instagram NVARCHAR(255) NULL;
    PRINT 'Columna instagram agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'tiktok')
BEGIN
    ALTER TABLE candidate_profiles ADD tiktok NVARCHAR(255) NULL;
    PRINT 'Columna tiktok agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'skills')
BEGIN
    ALTER TABLE candidate_profiles ADD skills NVARCHAR(MAX) NULL;
    PRINT 'Columna skills agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'city')
BEGIN
    ALTER TABLE candidate_profiles ADD city NVARCHAR(100) NULL;
    PRINT 'Columna city agregada a candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'country')
BEGIN
    ALTER TABLE candidate_profiles ADD country NVARCHAR(100) NULL;
    PRINT 'Columna country agregada a candidate_profiles';
END

GO

PRINT 'Migración completada: campos sociales y ubicación agregados a candidate_profiles';