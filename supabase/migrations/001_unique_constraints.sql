-- Add UNIQUE constraints to prevent duplicate names

ALTER TABLE customers ADD CONSTRAINT customers_name_unique UNIQUE (name);
ALTER TABLE suppliers ADD CONSTRAINT suppliers_name_unique UNIQUE (name);
ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);
