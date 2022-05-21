CREATE TABLE ticket (
    id TEXT,
    title TEXT,
    type TEXT,
    description TEXT,
    owner_id TEXT,
    assignee TEXT,
    organization TEXT,
    parent_id TEXT,
    status TEXT
);
CREATE TABLE filter (
    id TEXT,
    owner_id TEXT,
    expression TEXT
);
CREATE TABLE organization (
    id TEXT,
    parent_id TEXT
);
CREATE TABLE profiles (
    id TEXT,
    is_admin BOOLEAN,
    username TEXT,
    display_name TEXT,
    pass_hash TEXT
);
CREATE TABLE user_organization (
    user_id TEXT,
    organization_id TEXT
);
CREATE TABLE acl (
    id TEXT,
    user_id TEXT,
    action TEXT,
    object_type TEXT,
    filter TEXT
);
CREATE TABLE event (
    time TIMESTAMP,
    user_id TEXT,
    action TEXT,
    object_id TEXT,
    object_type TEXT,
    data TEXT[]
    );
-- SELECT create_hypertable("event", 'time');
-- SELECT set_chunk_time_interval("event", INTERVAL '1 days');
-- ALTER TABLE event SET (timescaledb.compress);
-- SELECT alter_job((SELECT add_compression_policy("event", INTERVAL '7 days')), schedule_interval => INTERVAL '7 days');
-- SELECT alter_job((SELECT add_retention_policy("event", INTERVAL '30 days')), schedule_interval => INTERVAL '30 days');