# 🏆 Quiniela Mundial 2026 — Plataforma de Pronósticos Deportivos & Brackets

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> Una plataforma web moderna, interactiva y robusta para la gestión de quinielas y predicciones del **Mundial FIFA 2026**. Diseñada para grupos de amigos, comunidades y empresas, con resolución recursiva de cuadros eliminatorios (*bracket*), motor de puntuación en tiempo real y arquitectura multi-sala (*multi-tenant*).

---

## 📌 Tabla de Contenidos
- [Características Principales](#-características-principales)
- [Lógica de Negocio y Algoritmos](#-lógica-de-negocio-y-algoritmos)
  - [Algoritmo Recursivo de Bracket](#1-algoritmo-recursivo-de-bracket-árbol-de-eliminatorias)
  - [Motor de Puntuación Avanzado](#2-motor-de-puntuación-avanzado)
- [Reglas del Sistema de Puntos](#-reglas-del-sistema-de-puntos)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura de Datos](#-arquitectura-de-datos)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Despliegue](#-despliegue)

---

## 🚀 Características Principales

- **🎮 Pronósticos de Fase de Grupos y Eliminatorias Directas:**
  - Cobertura completa de los 104 partidos del Mundial 2026 (fase de grupos, dieciseisavos, octavos, cuartos, semifinales, tercer puesto y gran final).
  - Bloqueo dinámico de pronósticos contra la zona horaria del partido para prevenir modificaciones posteriores al silbatazo inicial.

- **🌳 Bracket Dinámico e Interactivo:**
  - Mapeo en vivo de los emparejamientos en cascada según las predicciones de cada usuario.
  - Selección de ganador en partidos con pronóstico de empate (definiciones en tiempo extra o penales).

- **👥 Sistema de Salas Privadas (Ligas/Comunidades):**
  - Creación de salas con códigos únicos de invitación.
  - Los usuarios pueden pertenecer a múltiples salas simultáneamente manteniendo pronósticos unificados o individuales.

- **📊 Leaderboard y Ranking en Tiempo Real:**
  - Tabla de posiciones actualizada dinámicamente según se van cerrando los resultados oficiales.
  - Detalle individual de puntos obtenidos por partido y rendimiento general.

- **⚡ Recálculo y Sincronización Automatizada:**
  - APIs de recálculo masivo e integridad de datos tras actualizaciones en los marcadores oficiales.

---

## 🧠 Lógica de Negocio y Algoritmos

### 1. Algoritmo Recursivo de Bracket (Árbol de Eliminatorias)
A diferencia de quinielas estáticas convencionales, el bracket de eliminación directa depende de las decisiones previas del usuario. Se implementó una función recursiva de resolución de rutas:

$$\text{resolverEquipoRival}(\text{slot}, \text{profundidad})$$

- Resuelve slots dinámicos basados en ganadores (`W{n}`) y perdedores (`L{n}`).
- **Propagación en cascada:** Al cambiar un resultado en fases tempranas (ej. dieciseisavos), el sistema recalcula o limpia en cascada las ramas dependientes para evitar estados inconsistentes.
- **Validación de rivales cruzados:** Si el partido real enfrenta a dos equipos distintos a los que el usuario proyectó en su árbol, el sistema valida la coherencia antes de otorgar puntuación.

### 2. Motor de Puntuación Avanzado
El cálculo de puntos evalúa no solo el marcador final en los 90 minutos, sino también las proyecciones de clasificación a la siguiente ronda:
- Detección precisa de tendencias (Victoria Local, Empate, Victoria Visitante).
- Evaluación de empate técnico en los 90 minutos con pase a la siguiente ronda mediante tanda de penales o prórroga.

---

## 🎯 Reglas del Sistema de Puntos

| Escenario | Condición | Puntos Otorgados | Ejemplo |
| :--- | :--- | :---: | :--- |
| **Marcador Exacto** | Acierto exacto de goles de ambos equipos | **5 pts** | Predijiste `2 - 1` y el resultado oficial fue `2 - 1` |
| **Tendencia + Goles Parciales** | Aciertas el ganador o empate, y además aciertas los goles de al menos uno de los equipos | **3 pts** | Predijiste `2 - 0` y el resultado oficial fue `2 - 1` |
| **Empate con Goles Distintos** | Pronosticaste empate y el partido terminó en empate con distinto marcador | **3 pts** | Predijiste `1 - 1` y el resultado oficial fue `2 - 2` |
| **Tendencia Simple** | Aciertas quién gana el partido, pero fallas la cantidad exacta de goles | **2 pts** | Predijiste `3 - 0` y el resultado oficial fue `1 - 0` |
| **Clasificado en Eliminatorias tras Empate** | Predijiste empate en los 90 min y acertaste quién avanzaba a la siguiente fase (definición por penales/prórroga) | **2 pts** | Predijiste `2 - 2` pasando Noruega; resultado final fue `2 - 1` a favor de Noruega |
| **Resultado Erróneo / Bracket Roto** | No se acertó la tendencia, o los rivales proyectados no correspondían al encuentro oficial | **0 pts** | Predijiste victoria local y ganó el visitante |

---

## 🛠 Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 15 (App Router)** | Framework React con Server Components y Client Components para alta velocidad de renderizado. |
| **UI & Estilos** | **Tailwind CSS + Lucide Icons** | Diseño responsivo para dispositivos móviles, tablets y escritorio, con componentes accesibles. |
| **Backend & DB** | **Supabase (PostgreSQL)** | Almacenamiento relacional de datos, transacciones y Row Level Security (RLS). |
| **Autenticación** | **Supabase Auth** | Gestión segura de sesiones de usuario y vinculación a perfiles. |
| **Animaciones** | **Motion (Framer Motion)** | Transiciones fluidas en modales de pronóstico y visualización del bracket. |
| **Despliegue** | **Vercel** | CI/CD continuo, Edge network y serverless functions. |

---

## 🗄 Arquitectura de Datos

El modelo relacional en PostgreSQL está diseñado para garantizar la integridad referencial y alto rendimiento:

- **`matches`**: Almacena el fixture de los 104 partidos (fase, equipos local/visitante, fecha, estado `upcoming`/`locked`/`finished` y marcador final).
- **`rooms`**: Salas de juego privadas creadas por los usuarios, identificadas con código de acceso único.
- **`room_members`**: Relación n:m entre usuarios y salas, almacenando el puntaje acumulado (`total_points`).
- **`predictions`**: Pronósticos individuales vinculados por `user_id`, `room_id` y `match_id` (`pred_home_score`, `pred_away_score`, `predicted_winner` y `points_earned`).
- **`users`**: Datos de perfil de cada jugador vinculados al sistema de autenticación.

---

## 📂 Estructura del Proyecto

```text
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── fix-points/         # Endpoint administrativo para recálculo masivo de puntos
│   │   ├── sala/
│   │   │   └── [id]/
│   │   │       ├── partidos/       # Vista interactiva del fixture y modal de pronósticos
│   │   │       ├── ranking/        # Tabla de posiciones y leaderboard en vivo
│   │   │       └── page.js         # Vista general de la sala
│   │   ├── globals.css             # Estilos globales y utilidades Tailwind
│   │   ├── layout.tsx              # Root Layout con fuentes y providers
│   │   └── page.js                 # Dashboard principal y selector de salas
│   └── lib/
│       ├── supabase.js             # Cliente de conexión e inicialización de Supabase
│       └── utils.ts                # Funciones utilitarias (cn, formateadores)
├── public/                         # Assets estáticos y escudos
├── package.json                    # Dependencias y scripts
└── README.md                       # Documentación del proyecto
```

---

## 💻 Instalación y Configuración Local

Sigue estos pasos para clonar y ejecutar el proyecto en tu entorno local:

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/quiniela-mundial-2026.git
cd quiniela-mundial-2026
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto tomando como referencia `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-opcional
```

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

---

## 🚀 Despliegue en Producción

El proyecto está optimizado para desplegarse fácilmente en **Vercel**:

1. Conecta tu repositorio de GitHub con Vercel.
2. Añade las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el panel de configuración de Vercel.
3. Haz clic en **Deploy**. Cada `push` a la rama principal actualizará automáticamente el entorno productivo.

---

## 👨‍💻 Autor
Desarrollado con pasión por el fútbol y la ingeniería de software.  
*Contacto / LinkedIn:* [Tu Perfil] | *GitHub:* [@tu-usuario](https://github.com/tu-usuario)
