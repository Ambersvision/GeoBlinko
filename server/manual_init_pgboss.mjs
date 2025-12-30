import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

async function initPgBossTables() {
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create pgboss schema if it doesn't exist
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS pgboss;
    `);
    console.log('Created pgboss schema');

    // Create schedule table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pgboss.schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        priority INTEGER NOT NULL,
        data JSONB,
        state TEXT NOT NULL,
        retry_limit INTEGER,
        retry_count INTEGER,
        retry_delay INTEGER,
        retry_backoff BOOLEAN,
        expire_in_seconds INTEGER,
        start_after BIGINT,
        started_on TIMESTAMP WITH TIME ZONE,
        done_on TIMESTAMP WITH TIME ZONE,
        keep_until TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Created pgboss.schedule table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS schedule_state_idx ON pgboss.schedule (state);
    `);
    console.log('Created indexes');

    console.log('pg-boss tables initialized successfully!');

  } catch (error) {
    console.error('Failed to initialize pg-boss tables:', error);
    throw error;
  } finally {
    await client.end();
  }
}

initPgBossTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
