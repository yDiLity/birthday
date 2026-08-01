-- Editable pool of congratulations per user (seeded from the 650 static texts).
CREATE TABLE IF NOT EXISTS congratulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_congratulation UNIQUE (user_id, text)
);

CREATE INDEX IF NOT EXISTS idx_congratulations_user ON congratulations(user_id);

ALTER TABLE congratulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own congratulations" ON congratulations;
CREATE POLICY "Users can only access their own congratulations"
  ON congratulations
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own congratulations" ON congratulations;
CREATE POLICY "Users can insert their own congratulations"
  ON congratulations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own congratulations" ON congratulations;
CREATE POLICY "Users can update their own congratulations"
  ON congratulations
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own congratulations" ON congratulations;
CREATE POLICY "Users can delete their own congratulations"
  ON congratulations
  FOR DELETE
  USING (user_id = auth.uid());

-- Track used congratulations by row id instead of array index (rows are editable/deletable).
ALTER TABLE congratulations_usage DROP COLUMN IF EXISTS used_indexes;
ALTER TABLE congratulations_usage ADD COLUMN IF NOT EXISTS used_ids UUID[] NOT NULL DEFAULT '{}';
