#!/bin/bash
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contextos') THEN
    CREATE USER contextos WITH PASSWORD 'contextos' LOGIN CREATEDB;
  END IF;
END $$;
SELECT 'ok' WHERE EXISTS (SELECT FROM pg_database WHERE datname = 'contextos');
SQL
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='contextos'" | grep -q 1 || sudo -u postgres createdb -O contextos contextos
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE contextos TO contextos;"
echo READY
