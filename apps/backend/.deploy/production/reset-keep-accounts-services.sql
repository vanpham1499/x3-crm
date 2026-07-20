\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    truncate_statement text;
BEGIN
    SELECT 'TRUNCATE TABLE '
        || string_agg(format('%I.%I', schemaname, tablename), ', ')
        || ' RESTART IDENTITY CASCADE'
    INTO truncate_statement
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
          'migrations',
          'users',
          'roles',
          'permissions',
          'role_permissions',
          'departments',
          'services',
          'service_packages'
      );

    IF truncate_statement IS NOT NULL THEN
        EXECUTE truncate_statement;
    END IF;
END
$$;

COMMIT;
