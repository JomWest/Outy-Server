-- Create table to store message attachments
-- This migration adds a normalized record of attachments linked to chat messages

IF NOT EXISTS (
  SELECT * FROM sys.objects 
  WHERE object_id = OBJECT_ID(N'[dbo].[message_attachments]') AND type in (N'U')
)
BEGIN
  CREATE TABLE [dbo].[message_attachments] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [message_id] UNIQUEIDENTIFIER NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [mime] NVARCHAR(100) NOT NULL,
    [size] INT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_message_attachments] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_message_attachments_messages] FOREIGN KEY ([message_id])
      REFERENCES [dbo].[messages]([id]) ON DELETE CASCADE
  );

  -- Helpful index to query attachments by message
  CREATE INDEX [IX_message_attachments_message_id] ON [dbo].[message_attachments]([message_id]);
END