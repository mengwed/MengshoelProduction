-- Add toggle for showing the "Analysera om alla" button (default off)
ALTER TABLE company_settings
ADD COLUMN show_reparse_button boolean NOT NULL DEFAULT false;
