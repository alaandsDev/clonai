CREATE TABLE IF NOT EXISTS artifacts(job_id TEXT PRIMARY KEY REFERENCES jobs(id),url TEXT NOT NULL,expires_at TEXT NOT NULL,run_id TEXT NOT NULL,artifact_id TEXT NOT NULL,voice_warning TEXT);
CREATE TRIGGER IF NOT EXISTS artifact_complete AFTER INSERT ON artifacts BEGIN
 UPDATE jobs SET status='done',file_key=NULL,voice_warning=NEW.voice_warning,lease_token=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.job_id;
END;
CREATE TABLE IF NOT EXISTS render_attempts(token TEXT PRIMARY KEY,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS render_attempts_date ON render_attempts(created_at);
CREATE TRIGGER IF NOT EXISTS record_render_attempt AFTER UPDATE OF status ON jobs WHEN OLD.status='pending' AND NEW.status='processing' BEGIN
 INSERT INTO render_attempts VALUES(NEW.lease_token,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 DELETE FROM render_attempts WHERE created_at < datetime('now','-35 days');
END;
