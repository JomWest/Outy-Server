-- Ensure unique (department, municipality) pairs to avoid duplicates
IF OBJECT_ID('dbo.locations_nicaragua', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_locations_department_municipality'
      AND object_id = OBJECT_ID('dbo.locations_nicaragua')
  )
  BEGIN
    CREATE UNIQUE INDEX UX_locations_department_municipality
      ON dbo.locations_nicaragua (department, municipality);
  END
END