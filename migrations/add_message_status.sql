-- Migration: Add message status fields
-- Date: 2024-01-XX
-- Description: Add fields to track message delivery and read status

-- Add new columns to messages table
ALTER TABLE messages 
ADD 
    delivered_at DATETIME2 NULL,
    read_at DATETIME2 NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read'));
GO

-- Update existing messages to have 'delivered' status
UPDATE messages 
SET status = 'delivered', delivered_at = created_at 
WHERE status = 'sent';
GO

PRINT 'Message status fields added successfully!';