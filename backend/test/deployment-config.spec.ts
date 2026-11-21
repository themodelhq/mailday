import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Stage 40 deployment configuration', () => {
  const render = readFileSync(resolve(process.cwd(), '../render.yaml'), 'utf8');

  it('runs build without attempting database migrations', () => {
    const build = render.match(/buildCommand:\s*(.+)/)?.[1] ?? '';
    expect(build).toContain('npm ci');
    expect(build).toContain('prisma generate');
    expect(build).toContain('npm run build');
    expect(build).not.toContain('migrate deploy');
  });

  it('applies migrations at startup before starting the API', () => {
    const start = render.match(/startCommand:\s*(.+)/)?.[1] ?? '';
    expect(start).toContain('prisma migrate deploy');
    expect(start).toContain('start:prod');
  });

  it('mounts persistent attachment storage and configures the same path', () => {
    expect(render).toContain('mountPath: /var/data/mailday-attachments');
    expect(render).toContain('ATTACHMENTS_DIR');
    expect(render).toContain('value: /var/data/mailday-attachments');
  });

  it('documents backup and safe restore testing', () => {
    const runbook = readFileSync(resolve(process.cwd(), '../docs/BACKUP_AND_RECOVERY.md'), 'utf8');
    expect(runbook).toContain('pg_dump');
    expect(runbook).toContain('pg_restore');
    expect(runbook).toContain('never overwrite production');
    expect(runbook).toContain('attachment');
  });
});
