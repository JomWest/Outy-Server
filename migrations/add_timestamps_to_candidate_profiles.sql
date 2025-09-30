-- Migración para agregar columnas de timestamp a candidate_profiles
-- Fecha: 2025-01-29
-- Descripción: Agregar created_at y updated_at para el manejo de archivos BLOB

USE [OutyV1];
GO

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'created_at')
BEGIN
    ALTER TABLE candidate_profiles 
    ADD created_at DATETIME2 NULL;
    PRINT 'Columna created_at agregada a candidate_profiles';
END
ELSE
BEGIN
    PRINT 'Columna created_at ya existe en candidate_profiles';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'updated_at')
BEGIN
    ALTER TABLE candidate_profiles 
    ADD updated_at DATETIME2 NULL;
    PRINT 'Columna updated_at agregada a candidate_profiles';
END
ELSE
BEGIN
    PRINT 'Columna updated_at ya existe en candidate_profiles';
END

-- Actualizar registros existentes con timestamps por defecto (solo si las columnas existen)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'created_at')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'updated_at')
BEGIN
    UPDATE candidate_profiles 
    SET created_at = COALESCE(created_at, GETDATE()), 
        updated_at = COALESCE(updated_at, GETDATE());
    PRINT 'Registros existentes actualizados con timestamps';
END

-- Agregar valores por defecto para futuros registros (solo si las columnas existen)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'created_at')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('candidate_profiles') AND parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'created_at'))
    BEGIN
        ALTER TABLE candidate_profiles 
        ADD CONSTRAINT DF_candidate_profiles_created_at DEFAULT GETDATE() FOR created_at;
        PRINT 'Constraint por defecto agregado para created_at';
    END
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'updated_at')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('candidate_profiles') AND parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('candidate_profiles') AND name = 'updated_at'))
    BEGIN
        ALTER TABLE candidate_profiles 
        ADD CONSTRAINT DF_candidate_profiles_updated_at DEFAULT GETDATE() FOR updated_at;
        PRINT 'Constraint por defecto agregado para updated_at';
    END
END

PRINT 'Migración completada: columnas de timestamp agregadas a candidate_profiles';
GO