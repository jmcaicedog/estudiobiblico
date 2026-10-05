# Estudio Bíblico

Plataforma Next.js para estudiar un curso, guardar el progreso individual y
administrar módulos, lecciones, diapositivas PDF y enlaces de estudio.

## Configuración

Requiere Node.js 22.18 o superior y una base PostgreSQL en Neon.

1. Instala las dependencias con `npm ci`.
2. Copia `.env.example` a `.env.local` y configura:
   - `DATABASE_URL`: cadena de conexión de Neon.
   - `ADMIN_EMAIL`: correo del único administrador, reservado para esa cuenta.
   - `ADMIN_PASSWORD`: contraseña administrativa de entre 12 y 128 caracteres.
     No existen credenciales predeterminadas. Cambia la contraseña local antes
     de desplegar y no publiques el archivo de entorno.
3. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Configura también estas variables en el servicio donde despliegues la aplicación.
Los secretos permanecen en el servidor; no uses el prefijo `NEXT_PUBLIC_`.
No se utiliza una base en memoria: una conexión ausente o fallida muestra un
error en lugar de aparentar que las cuentas y el progreso fueron guardados.

## Usuarios y permisos

- La portada presenta inicio de sesión, registro y acceso administrativo.
- El registro público crea exclusivamente estudiantes con correo y contraseña.
- Cada estudiante solo consulta el curso y registra su propio progreso.
- `/admin` permite iniciar sesión con el correo y la contraseña administrativos.
  Solo ese administrador puede editar cursos, módulos, lecciones y recursos.
- Las contraseñas de estudiantes se almacenan con scrypt y sal aleatoria.
  Las sesiones usan tokens aleatorios, almacenados como hashes en Neon, y cookies
  HttpOnly (Secure en producción). Caducan a los siete días y se revocan al salir.
- Los intentos de autenticación se limitan por correo a diez por cada quince
  minutos. En producción, complementa esta protección con límites por IP en el
  servicio de alojamiento.

El correo administrativo debe mantenerse estable después del primer acceso:
existe un índice que garantiza una sola cuenta administradora. Cambiarlo requiere
una migración explícita de esa cuenta. El registro no puede promover estudiantes.

## Lecciones y recursos

Al crear o editar una lección, el administrador puede:

- Adjuntar un PDF de diapositivas de hasta **10 MiB**, reemplazarlo o eliminarlo.
- Añadir, editar y eliminar enlaces con título y URL HTTP/HTTPS. No hay un límite
  de cantidad de enlaces por lección.

El PDF y la lista de enlaces se guardan junto con la lección en una única consulta.
Reordenar una lección conserva sus recursos. Los estudiantes acceden a ellos en
**Notas y Recursos**; descargar el PDF exige una sesión válida.

Los PDFs se guardan en Neon como BYTEA, no en el disco del servidor. La aplicación
admite solicitudes de hasta 12 MiB para incluir el PDF y el formulario; el límite
del servicio de alojamiento también debe permitir ese tamaño (algunos servicios
serverless imponen límites menores). Para grandes volúmenes, conviene migrar los
archivos a almacenamiento de objetos.

## Esquema y progreso anterior

La primera conexión inicializa el esquema de forma transaccional e idempotente,
agregando las columnas de recursos y las tablas `app_users`, `app_sessions`,
`auth_attempts` y `user_lesson_completions`. La conexión necesita permisos DDL.
Los cursos, módulos y lecciones existentes se conservan. En una base nueva se
crea un curso inicial vacío para que el administrador añada su contenido.

La antigua tabla `lesson_completions` se conserva, pero ya no se utiliza: su
progreso era global y no puede atribuirse a un estudiante. Las nuevas
completaciones tienen una clave única `(user_id, lesson_id)` y se guardan por
cuenta, con independencia del navegador o dispositivo.

## Validación

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Las pruebas unitarias cubren hashes de contraseña, normalización de correo,
validación de enlaces, el límite exacto del PDF y la selección del reproductor
para YouTube, Vimeo y videos directos. Para probar la persistencia,
registra dos cuentas, completa una lección con una de ellas, inicia sesión de
nuevo y comprueba que la otra cuenta conserva su progreso independiente.
