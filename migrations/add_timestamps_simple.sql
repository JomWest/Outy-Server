-- Migración simple para agregar columnas de timestamp a candidate_profiles
-- Fecha: 2025-01-29

USE [OutyV1];
GO

-- Agregar columna created_at si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'created_at')
BEGIN
    ALTER TABLE candidate_profiles ADD created_at DATETIME2 DEFAULT GETDATE();
    PRINT 'Columna created_at agregada a candidate_profiles';
END
ELSE
BEGIN
    PRINT 'Columna created_at ya existe en candidate_profiles';
END

-- Agregar columna updated_at si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'updated_at')
BEGIN
    ALTER TABLE candidate_profiles ADD updated_at DATETIME2 DEFAULT GETDATE();
    PRINT 'Columna updated_at agregada a candidate_profiles';
END
ELSE
BEGIN
    PRINT 'Columna updated_at ya existe en candidate_profiles';
END

PRINT 'Migración completada exitosamente';
GO