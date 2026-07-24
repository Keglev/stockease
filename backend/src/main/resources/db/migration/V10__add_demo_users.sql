-- Two additional demo users so movement and audit views show
-- multiple realistic actors. Users are permanent data: the demo
-- reset deliberately never touches app_user, so a migration is the
-- honest home for these rows.
INSERT INTO app_user (username, password, role)
VALUES
    ('julia.brandt', '$2a$10$2ikSVvwuO6Z1EFZgrJx9WebzXqqJ81QnSekkjzProceW1pQF.WtrC', 'ROLE_USER'),
    ('markus.weber', '$2a$10$ZNCCCfR4gKJFjOBfffvhkuosBkQIxowhYs1/uOifGaEBQPExGt6EK', 'ROLE_USER');
