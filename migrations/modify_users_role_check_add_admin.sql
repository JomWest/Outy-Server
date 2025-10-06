-- Drop existing CHECK constraint on users.role dynamically
DECLARE @ConstraintName NVARCHAR(128);
SELECT @ConstraintName = dc.name
FROM sys.check_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
JOIN sys.objects o ON o.object_id = dc.parent_object_id
WHERE o.name = 'users' AND c.name = 'role';

IF @ConstraintName IS NOT NULL
BEGIN
  DECLARE @sql NVARCHAR(MAX) = N'ALTER TABLE users DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
  EXEC sp_executesql @sql;
END;

-- Add new CHECK constraint allowing admin roles
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_users_role_allowed')
BEGIN
  ALTER TABLE users
  ADD CONSTRAINT CK_users_role_allowed CHECK (role IN ('candidato','empleador','admin','super_admin'));
END;