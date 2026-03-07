# StreamVibe — Guide de Déploiement Production

## Prérequis
- Node.js >= 18
- Compte MongoDB Atlas (gratuit) : https://cloud.mongodb.com
- Un éditeur de code (VS Code recommandé)

---

## 1. Configurer MongoDB Atlas

1. Créer un compte sur **https://cloud.mongodb.com**
2. Créer un cluster **gratuit (M0)**
3. Dans **Database Access** : créer un utilisateur avec mot de passe
4. Dans **Network Access** : ajouter `0.0.0.0/0` (ou votre IP)
5. Copier la **Connection String** : `mongodb+srv://user:password@cluster0.xxx.mongodb.net/`

---

## 2. Configurer l'environnement backend

```bash
# Aller dans le dossier backend
cd backend

# Copier le fichier d'exemple
copy .env.example .env
```

Modifier `.env` avec vos vraies valeurs :

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:MotDePasse@cluster0.xxxxx.mongodb.net/streamvibe?retryWrites=true&w=majority
JWT_SECRET=VOTRE_SECRET_64_CARACTERES_MINIMUM_ICI
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@votresite.com
ADMIN_PASSWORD=VotreMotDePasseAdmin!
FRONTEND_URL=http://localhost:5500
```

> **Génération d'un JWT_SECRET sécurisé :**
> Ouvrez PowerShell et tapez :  
> `[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))`

---

## 3. Installer et démarrer le backend

```bash
cd backend
npm install
npm start
```

Vous devriez voir :
```
✅  MongoDB connecté
✅  Admin créé: admin@votresite.com
✅  Médias de démonstration ajoutés
🚀  StreamVibe API lancé sur http://localhost:5000
```

---

## 4. Configurer le frontend

Ouvrir `assets/js/db-service.js` et vérifier la ligne :

```javascript
const API_BASE = 'http://localhost:5000/api';
```

En production, changer pour votre domaine :
```javascript
const API_BASE = 'https://api.votre-domaine.com/api';
```

---

## 5. Ouvrir le site

- Ouvrir `index.html` dans votre navigateur (ou avec Live Server de VS Code)
- Ouvrir `admin.html` pour le dashboard
- Connexion admin : email et mot de passe définis dans `.env`

---

## Structure du projet

```
Multimedia_Project/
├── index.html              ← Site public
├── admin.html              ← Dashboard admin
├── assets/
│   ├── css/
│   │   ├── main.css        ← Design système complet
│   │   └── admin.css       ← Styles dashboard
│   └── js/
│       ├── db-service.js   ← Client API (MongoDB)
│       ├── main.js         ← Logique site public
│       ├── admin.js        ← Logique dashboard
│       ├── players.js      ← Lecteurs médias
│       └── theme-toggle.js ← Thème sombre/clair
└── backend/
    ├── server.js           ← Point d'entrée serveur
    ├── package.json
    ├── .env                ← Variables d'environnement (à créer)
    ├── models/
    │   ├── Media.js        ← Schéma MongoDB médias
    │   └── Admin.js        ← Schéma MongoDB admin
    ├── routes/
    │   ├── media.js        ← API /api/media (CRUD)
    │   └── auth.js         ← API /api/auth (login)
    └── middleware/
        └── auth.js         ← Protection JWT
```

---

## API Reference

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/health` | Non | Statut du serveur |
| GET | `/api/media` | Non | Tous les médias |
| GET | `/api/media?type=video` | Non | Filtre par type |
| GET | `/api/media?featured=true` | Non | En vedette |
| GET | `/api/media?search=mot` | Non | Recherche textuelle |
| GET | `/api/media/:id` | Non | Un média par ID |
| POST | `/api/media` | **JWT** | Créer un média |
| PUT | `/api/media/:id` | **JWT** | Modifier un média |
| PATCH | `/api/media/:id/featured` | **JWT** | Toggle vedette |
| DELETE | `/api/media/:id` | **JWT** | Supprimer un média |
| GET | `/api/media/admin/stats` | **JWT** | Statistiques |
| POST | `/api/auth/login` | Non | Connexion admin |
| GET | `/api/auth/me` | **JWT** | Profil admin |

---

## Déploiement en ligne (optionnel)

### Backend sur Railway (gratuit)
1. Aller sur https://railway.app
2. Nouveau projet → Deploy from GitHub
3. Ajouter les variables d'environnement dans Railway
4. Railway donne une URL du type `https://streamvibe-backend.railway.app`

### Frontend sur Netlify (gratuit)
1. Aller sur https://netlify.com
2. Glisser-déposer le dossier `Multimedia_Project/` (sans le dossier `backend/`)
3. Dans `db-service.js`, mettre l'URL Railway en `API_BASE`
4. Netlify donne une URL du type `https://streamvibe.netlify.app`
5. Mettre cette URL dans `FRONTEND_URL` du `.env` backend

---

## Sécurité (checklist production)

- [x] Helmet.js (headers de sécurité)
- [x] CORS restreint à votre domaine frontend
- [x] Rate limiting sur toutes les routes
- [x] Rate limiting strict sur `/auth/login` (10 req/15min)
- [x] Mot de passe hashé avec bcrypt (salt 12)
- [x] JWT signé avec secret fort
- [x] Validation des données avec express-validator
- [x] Erreurs génériques en production (pas de stack trace)
