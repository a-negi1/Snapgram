# Snapgram

A modern, real-time full-stack social media application built with React, Express, MongoDB, Socket.IO, and Firebase.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Vanilla CSS, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO, Mongoose |
| Database | MongoDB Atlas / Local MongoDB |
| Auth | Firebase Authentication |

## Project Structure

```
snapgram/
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── index.js
└── frontend/
    ├── public/
    └── src/
        ├── components/
        ├── pages/
        ├── App.css
        ├── App.jsx
        ├── api.js
        ├── firebase.js
        ├── main.jsx
        └── socket.js
```

## Local Setup

### Prerequisites

- Node.js ≥ 16
- MongoDB Atlas cluster or Local MongoDB instance
- Firebase project with Authentication enabled

### 1. Clone

```bash
git clone <your-repository-url>
cd snapgram
```

### 2. Configure environment variables

```bash
cd backend
cp .env.example .env

cd ../frontend
# Create a .env file and add your Firebase config
```

Fill in all necessary values in both `.env` files.

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run

```bash
cd backend && npm run dev
cd ../frontend && npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Deployment

### Backend → Render

1. Push your code to GitHub.
2. Create a new **Web Service** on [Render](https://render.com), connect the repo, and set the root directory to `backend`.
3. Set the Build Command to `npm install` and the Start Command to `npm start`.
4. Add all required environment variables from `backend/.env.example` in the Render dashboard.

### Frontend → Vercel

1. Create a new project on [Vercel](https://vercel.com), connect the repo, and set the root directory to `frontend`.
2. Add all your Firebase environment variables in the Vercel dashboard.
3. Set your production backend URL if required.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT | `/api/users/*` | User profiles, following, and follower management |
| GET/POST/DELETE | `/api/posts/*` | Create, read, delete posts, and manage likes |
| GET/POST | `/api/comments/*` | Fetch and add comments to posts |
| GET/PUT | `/api/notifications/*` | Retrieve notifications and mark as read |
| GET/POST | `/api/stories/*` | Story creation and retrieval |

## License

MIT
