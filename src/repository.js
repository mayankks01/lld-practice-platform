import { DatabaseSync } from 'node:sqlite';
import { Attempt, DomainError } from './domain.js';

/** Repository port: get(id), list(), insert(attempt), save(attempt, expectedVersion), close(). */
export class SqliteAttemptRepository {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL
      );`);
  }
  get(id) {
    const row = this.db.prepare('SELECT data FROM attempts WHERE id = ?').get(id);
    if (!row) throw new DomainError('Attempt not found.', 404);
    return new Attempt(JSON.parse(row.data));
  }
  list() {
    return this.db.prepare('SELECT data FROM attempts ORDER BY rowid DESC').all().map(row => new Attempt(JSON.parse(row.data)));
  }
  insert(attempt) {
    this.db.prepare('INSERT INTO attempts (id, version, data) VALUES (?, ?, ?)').run(attempt.id, attempt.version, JSON.stringify(attempt));
    return attempt;
  }
  save(attempt, expectedVersion) {
    const result = this.db.prepare('UPDATE attempts SET version = ?, data = ? WHERE id = ? AND version = ?')
      .run(attempt.version, JSON.stringify(attempt), attempt.id, expectedVersion);
    if (!result.changes) throw new DomainError('This draft changed in another tab. Reload it before saving.', 409);
    return attempt;
  }
  close() { this.db.close(); }
}
