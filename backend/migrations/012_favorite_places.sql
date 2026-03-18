-- +goose Up
-- no-op: original CREATE TABLE was lost due to SQLite lock race;
-- table creation moved to migration 013

-- +goose Down
-- no-op
