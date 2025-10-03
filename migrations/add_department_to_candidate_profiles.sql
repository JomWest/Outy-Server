-- Adds optional department column to candidate_profiles if it doesn't exist
IF COL_LENGTH('candidate_profiles', 'department') IS NULL
BEGIN
    ALTER TABLE candidate_profiles ADD department NVARCHAR(100) NULL;
END