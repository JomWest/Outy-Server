USE [OutyV1];
GO

-- Verificar si la columna permite NULL
SELECT 
  TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'job_application_id';
GO

-- Verificar estado de la clave foránea asociada
SELECT 
  fk.name AS fk_name,
  fk.is_disabled,
  fk.is_not_trusted
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('dbo.reviews');