-- Create congratulations_usage table to track which congratulation texts
-- have already been shown to each user (pool without repeats, C3).
CREATE TABLE IF NOT EXISTS congratulations_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  used_indexes INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable row level security
ALTER TABLE congratulations_usage ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read their own usage
DROP POLICY IF EXISTS "Users can only access their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can only access their own congratulations usage"
  ON congratulations_usage
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: users can insert their own usage
DROP POLICY IF EXISTS "Users can insert their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can insert their own congratulations usage"
  ON congratulations_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: users can update their own usage
DROP POLICY IF EXISTS "Users can update their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can update their own congratulations usage"
  ON congratulations_usage
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: users can delete their own usage
DROP POLICY IF EXISTS "Users can delete their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can delete their own congratulations usage"
  ON congratulations_usage
  FOR DELETE
  USING (user_id = auth.uid());
