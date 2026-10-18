# ⏱ Fichaje — App de Control de Horas

App móvil (PWA) minimalista para registrar fichajes, controlar horas trabajadas y horas extra, con sincronización a Google Sheets.

## ✨ Características

- **Fichaje rápido** — Un toque para registrar entrada y salida
- **Temporizador en vivo** — Visualiza el tiempo de la sesión actual
- **Cálculo automático de horas extra** — Basado en tu jornada configurada
- **Historial completo** — Todos tus registros organizados por día
- **Estadísticas** — Resumen semanal y mensual con gráficas
- **Google Sheets** — Sincroniza tus datos con una hoja de cálculo
- **Exportar CSV** — Descarga tus registros en formato CSV
- **Offline** — Funciona sin conexión gracias al Service Worker
- **Instalable** — Se puede instalar en el móvil como app nativa
- **Modo oscuro** — Se adapta a la configuración del sistema

## 🚀 Instalación

### Opción A: Usar en local

1. Abre una terminal en esta carpeta
2. Levanta un servidor local:
   ```bash
   # Con Python 3
   python -m http.server 8080
   
   # O con Node.js (npx)
   npx serve .
   ```
3. Abre `http://localhost:8080` en tu navegador móvil
4. En el navegador, toca "Añadir a pantalla de inicio" para instalarla

### Opción B: Publicar en GitHub Pages (recomendado)

1. Sube esta carpeta a un repositorio de GitHub
2. Ve a Settings → Pages → Source: `main` branch
3. Tu app estará disponible en `https://tu-usuario.github.io/fichaje-app/`
4. Abre la URL en tu móvil e instálala como PWA

## 📊 Conectar con Google Sheets

### Paso 1: Crear la hoja de cálculo

1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja
2. Dale un nombre (ej: "Mis Fichajes")

### Paso 2: Configurar el Apps Script

1. En la hoja de cálculo, ve a **Extensiones → Apps Script**
2. Borra el código que aparece por defecto
3. Copia y pega el contenido del archivo `google-apps-script/Code.gs`
4. Guarda el proyecto (Ctrl+S)

### Paso 3: Desplegar como Web App

1. Haz clic en **Implementar → Nueva implementación**
2. Tipo: selecciona **Aplicación web**
3. Configuración:
   - **Descripción**: Fichaje API
   - **Ejecutar como**: Yo (tu email)
   - **Quién tiene acceso**: Cualquiera
4. Haz clic en **Implementar**
5. **Copia la URL** que aparece

### Paso 4: Conectar la app

1. Abre la app Fichaje en tu móvil
2. Ve a **Ajustes → Google Sheets**
3. Pega la URL del Web App
4. Toca **Sincronizar**

> **Nota**: Cada vez que modifiques el código del Apps Script, necesitas crear una **nueva implementación** para que los cambios surtan efecto.

## 📁 Estructura del proyecto

```
fichaje-app/
├── index.html              # Página principal
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker (offline)
├── css/
│   └── styles.css          # Estilos (Apple-style)
├── js/
│   └── app.js              # Lógica de la aplicación
├── google-apps-script/
│   └── Code.gs             # Backend para Google Sheets
├── icons/                  # Iconos PWA (crear manualmente)
└── README.md               # Este archivo
```

## ⚙️ Configuración

En la pestaña **Ajustes** puedes configurar:

| Opción | Descripción | Valor por defecto |
|--------|------------|-------------------|
| Horas por día | Tu jornada laboral diaria | 8 horas |
| Horas por semana | Tu jornada semanal | 40 horas |

Las horas extra se calculan automáticamente cuando trabajas más de las horas configuradas por día.

## 🔒 Privacidad

- Todos los datos se guardan **localmente** en tu dispositivo (localStorage)
- La sincronización con Google Sheets es **opcional** y usa tu propia cuenta
- No se envían datos a ningún servidor externo
- No hay analytics ni tracking

## 📱 Crear los iconos PWA

Para una instalación PWA correcta, necesitas crear iconos. Puedes:

1. Usar cualquier generador de iconos PWA online
2. Crear dos archivos PNG en la carpeta `icons/`:
   - `icon-192.png` (192×192 px)
   - `icon-512.png` (512×512 px)
3. Usa un diseño simple: un reloj o checkmark sobre fondo azul (#007AFF)

---

Hecho con ♥ para uso personal

