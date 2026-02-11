-- Telegram Bot Tables
-- Run this migration in Supabase SQL Editor

-- Tracks callback actions for idempotency
CREATE TABLE IF NOT EXISTS telegram_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  callback_id text UNIQUE NOT NULL,
  action_type text NOT NULL,
  target_id text NOT NULL,
  user_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tracks sent notifications
CREATE TABLE IF NOT EXISTS telegram_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type text NOT NULL,
  target_id text,
  message_id bigint,
  chat_id text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_actions_target ON telegram_actions (target_id);
CREATE INDEX IF NOT EXISTS idx_telegram_actions_status ON telegram_actions (status);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_type ON telegram_notifications (notification_type);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_target ON telegram_notifications (target_id);

-- Add reviewed_at column to blog_posts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN reviewed_at timestamptz;
  END IF;
END
$$;
