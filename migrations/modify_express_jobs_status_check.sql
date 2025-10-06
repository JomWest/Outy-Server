USE [OutyV1];

-- Drop existing CHECK constraint on express_jobs.status dynamically
DECLARE @ConstraintName NVARCHAR(128);
SELECT @ConstraintName = dc.name
FROM sys.check_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
JOIN sys.objects o ON o.object_id = dc.parent_object_id
WHERE o.name = 'express_jobs' AND c.name = 'status';

IF @ConstraintName IS NOT NULL
BEGIN
  DECLARE @sql NVARCHAR(MAX) = N'ALTER TABLE express_jobs DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
  EXEC sp_executesql @sql;
END;


-- Add new CHECK constraint allowing review and deleted statuses
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_express_jobs_status_allowed')
BEGIN
  ALTER TABLE express_jobs
  ADD CONSTRAINT CK_express_jobs_status_allowed CHECK (status IN ('abierto','en_proceso','completado','cancelado','en_revision','eliminado'));
END;