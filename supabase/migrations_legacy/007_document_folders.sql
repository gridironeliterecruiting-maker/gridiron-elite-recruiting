-- Migration 007: Document Folders
-- Adds folder support to athlete_documents (folders are rows with type='folder')

ALTER TABLE athlete_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES athlete_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_athlete_documents_folder ON athlete_documents(folder_id);
