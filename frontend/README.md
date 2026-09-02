# VYON — Mockup (Gestión de Proyectos y Tareas estilo ClickUp)

Mockup visual y navegable del producto VYON. Stack: **React + Vite + TypeScript + Tailwind CSS + Supabase Auth**.

Despliegue RECOMENDADO ✅: **S3 Static Website + CloudFront CDN + Invalidación caché** (script `deploy.sh` automático).
Alternativa fallback: **Lambda + Function URL** vía `serverless.yml` (conservado).

> Alcance actual: maqueta visual 100% navegable con login/registro reales contra Supabase + tablero Kanban con datos mock. Sin lógica CRUD real de tareas ni drag&drop persistente.

---

## 🏗️ Estructura

```
Vyon/
└── frontend/
    ├── public/                   # favicon y assets estáticos
    ├── src/
    │   ├── components/         # Sidebar, TaskCard, DashboardLayout, etc.
    │   ├── context/          # AuthContext (Supabase)
    │   ├── data/             # Mock data hardcodeada
    │   ├── pages/            # Landing, Login, Register, Dashboard
    │   ├── supabase/       # Cliente @supabase/supabase-js
    │   ├── App.tsx           # Rutas
    │   ├── main.tsx          # Punto de entrada
    │   └── index.css        # Tailwind + clases VYON
    ├── deploy.sh           # ⭐ DESPLIEGUE AUTO S3 + CLOUDFRONT + INVALIDACION CACHE
    ├── server.js            # Express sirve dist/ (fallback Lambda)
    ├── lambda.js           # Handler Lambda serverless-http
    ├── serverless.yml   # Lambda aislada (alternativa)
    ├── .env.example     # Plantilla variables
    └── README.md         # Este archivo
```

---

## ✅ 1. Pre-requisitos

- Node.js 20+
- npm
- Proyecto Supabase + esquema SQL ejecutado
- AWS CLI 2.x instalado y configurado

---

## 🚀 2. Correr en local

```bash
cd frontend

# 1. Instalar dependencias
npm install

# 2. Credenciales Supabase
cp .env.example .env
# edita .env y pega tus credenciales

# 3. Dev server con hot-reload
npm run dev
# abre http://localhost:5173
```

Build producción idéntico a AWS:

```bash
npm run build     # genera dist/
npm start       # Express en http://localhost:3000
```

---

## 🔐 3. Configurar Supabase

1. Entra a tu proyecto Supabase (co)
2. Abre SQL Editor y ejecuta el esquema SQL completo (profiles + trigger + workspaces + projects + tasks + RLS)
3. Copia Project URL y anon key desde **Settings → API**
4. Pégalo en `frontend/.env`:

```env
VITE_SUPABASE_URL=https://gufsiwwftsmkzawpfgpx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## ☁️ 4. Despliegue PRINCIPAL: S3 + CloudFront (Script ⭐

Arquitectura SPA óptima: **bucket S3 privado** + **CloudFront CDN global** con **OAC (Origin Access Control)** + **invalidación de caché `/*`** después de cada deploy. Todo con un **1 solo comando.

**No toca ninguna Lambda, API Gateway, ni recursos de tus otros proyectos (FYN, TradeBridge, etc.). Stack AISLADO TOTAL.

### 🛂 PASO 1 (solo 1 vez): Configurar permisos AWS IAM (usuario despliegue)

Crea un **IAM user NUEVO (no reutilices FYN/TradeBridge) llamado `vyon-deploy-user`, crea una política y adhiérela. Política mínima incluida al final de [deploy.sh](file:///Users/davidgalvis/Documents/Vyon/frontend/deploy.sh#L388).

O, si tu usuario AWS ya tiene permisos **AdministratorAccess**, puedes saltarte este paso.

Luego configura AWS CLI:

```bash
aws configure
# AWS Access Key ID:  <tu-access-key-del-vyon-deploy-user>
# AWS Secret Access Key: <tu-secret>
# Default region name: us-east-1
# Default output format: json

# valida que esté bien
aws sts get-caller-identity
```

### 🛂 PASO 2: Ejecutar despliegue

```bash
cd frontend
chmod +x deploy.sh   # solo la primera vez

# Despliegue stage=dev, region=us-east-1
./deploy.sh

# Despliegue producción en otra region
./deploy.sh dev us-east-1

# Despliegue PROD (nombre bucket+distinto
./deploy.sh prod
```

**El script hace TODO por ti, paso a paso:

```
(1/6 ✅ Validaciones (AWS, Node, .env)
(2/6 ✅ Build producción Vite
(3/6 ✅ CloudFormation crea S3 privado + CloudFront con OAC + política bucket
(4/6 ✅ Sube archivos (assets con cache 1 año, index.html sin caché)
(5/6 ✅ Crea invalidación CloudFront /* → cancela caché globalmente
(6/6 ✅ Imprime URL final  https://<distribution>.cloudfront.net
```

### Recursos CREADOS (todos aislados, prefijo `vyon-mockup-`)

| Recurso | Nombre |
|---|---|
| CloudFormation Stack | `vyon-mockup-s3-cf-stack-dev` |
| Bucket S3 | `vyon-mockup-site-us-east-1-dev` |
| Distribución CloudFront | (id dinámico) |
| Origin Access Control | `vyon-mockup-oac-dev` |
| Cache Policy | `vyon-mockup-cache-policy-dev` |

### ❌ Eliminar todos los recursos (1 comando, no toca nada más):

```bash
aws cloudformation delete-stack \
  --region us-east-1 \
  --stack-name vyon-mockup-s3-cf-stack-dev
```

---

## ☁️ 5. Alternativa: Despliegue Lambda Function URL)

Se conserva [serverless.yml](file:///Users/davidgalvis/Documents/Vyon/frontend/serverless.yml) si prefieres Lambda en vez de S3+CloudFront.

```bash
npm install -g serverless
npm run build
serverless deploy --stage dev
```

Output: Function URL `https://xxx.lambda-url.us-east-1.on.aws/

Eliminar con `serverless remove --stage dev`.

---

## 🖥️ 6. Páginas disponibles

| Ruta | Pública? | Descripción |
|---|---|---|
| `/` | ✅ | Landing pública (hero + 6 features + testimonios + CTA |
| `/login` | ✅ | Inicio sesión Supabase email+password |
| `/register` | ✅ | Registro (crea usuario + profile via trigger SQL |
| `/dashboard` | ❌ | Dashboard sidebar+Kanban 3 cols |

Protección de rutas implementada en [ProtectedRoute.tsx](file:///Users/davidgalvis/Documents/Vyon/frontend/src/components/ProtectedRoute.tsx).

---

## 🎨 7. Paleta y diseño

- **Fondo**: `#0A0A1A` (negro/azul marino
- **Acentos**: degradado `#FFC837 → #FF8008`
- **Tipografía**: Inter (blanca sobre fondo oscuro)
- **Componentes**: `.vyon-btn-primary`, `.vyon-card`, `.vyon-input`, `.vyon-task-card`, `.vyon-gradient-text`

---

## 🛣️ Roadmap próxima fase

- Drag & drop Kanban, CRUD real tareas/proyectos/workspaces, Supabase Realtime, calendario, Gantt, PDFs, notificaciones, roles.
