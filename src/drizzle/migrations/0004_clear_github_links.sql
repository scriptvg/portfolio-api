-- Data migration: quita el vínculo de GitHub de todos los usuarios.
-- Los usuarios siguen pudiendo entrar con correo/contraseña u OAuth de Google si los tienen.
UPDATE `users` SET `githubId` = NULL WHERE `githubId` IS NOT NULL;
