CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE folders (
  id uuid DEFAULT uuid_generate_v4 (),
  name TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE notes (
  id uuid DEFAULT uuid_generate_v4 (),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  modified TIMESTAMPTZ DEFAULT now() NOT NULL,
  folder uuid REFERENCES folders(id)
    ON DELETE CASCADE,
  PRIMARY KEY (id)
);
