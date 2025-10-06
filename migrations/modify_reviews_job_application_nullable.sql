-- Migración: permitir NULL en reviews.job_application_id y mantener FK opcional
-- Fecha: 2025-10-05
-- Objetivo: permitir reseñas genéricas sin postulación vinculada

USE [OutyV1];
GO

DECLARE @fk_name NVARCHAR(128);
SELECT TOP 1 @fk_name = fk.name
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('dbo.reviews')
  AND fk.referenced_object_id = OBJECT_ID('dbo.job_applications');

IF @fk_name IS NOT NULL
BEGIN
    PRINT 'Eliminando FK existente: ' + @fk_name;
    DECLARE @sql NVARCHAR(400);
    SET @sql = N'ALTER TABLE dbo.reviews DROP CONSTRAINT ' + QUOTENAME(@fk_name);
    EXEC sp_executesql @sql;
END
GO

-- Hacer la columna NULLABLE
ALTER TABLE dbo.reviews 
    ALTER COLUMN job_application_id UNIQUEIDENTIFIER NULL;
GO

-- Volver a crear la FK (permite NULLs)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE parent_object_id = OBJECT_ID('dbo.reviews')
      AND name = 'FK_reviews_job_application')
BEGIN
    ALTER TABLE dbo.reviews 
        ADD CONSTRAINT FK_reviews_job_application 
        FOREIGN KEY (job_application_id) REFERENCES dbo.job_applications(id);
END
GO

PRINT 'Migración completada: reviews.job_application_id ahora permite NULL y mantiene FK opcional.'