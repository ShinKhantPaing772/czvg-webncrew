-- Run AFTER importing explicit IDs, while application writes are stopped.
-- Covers identity columns in the current schema; does not alter IDs.
DO $$
DECLARE
  identity_column RECORD;
  sequence_name TEXT;
  highest_id BIGINT;
BEGIN
  FOR identity_column IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND is_identity = 'YES'
  LOOP
    sequence_name := pg_get_serial_sequence(format('%I.%I', current_schema(), identity_column.table_name), identity_column.column_name);
    EXECUTE format('SELECT MAX(%I) FROM %I.%I', identity_column.column_name, current_schema(), identity_column.table_name) INTO highest_id;
    PERFORM setval(sequence_name::regclass, GREATEST(COALESCE(highest_id, 1), 1), highest_id IS NOT NULL AND highest_id >= 1);
  END LOOP;
END $$;
