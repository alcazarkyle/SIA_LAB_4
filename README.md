# SIA_LAB_4 — Real-time Notification & Broadcast System

## 📌 Project Overview
A real-time web application built with Node.js, Socket.IO, Redis/Memurai, and MySQL that enables live login notifications and instant announcement broadcasting across all connected clients.

## ✨ Features
- ✅ User Registration & Login (JWT Authentication)
- ✅ Role-based Dashboard — Admin / Staff / User
- ✅ 🔴 Live Login Notifications (Real-time via Socket.IO)
- ✅ 📢 Broadcast Announcements (Real-time via Socket.IO + Redis)
- ✅ 👥 Admin User Management — Edit & Delete Users
- ✅ ⚠️ Self-delete Protection — Admin cannot delete own account

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **Real-time:** Socket.IO, Redis / Memurai
- **Database:** MySQL
- **Authentication:** JWT (JSON Web Token)

## 📂 Project Structure

role-login-lab/
├── public/
│   ├── login.html      # Login & Registration page
│   ├── admin.html      # Admin Dashboard
│   ├── staff.html      # Staff Dashboard
│   └── user.html       # User Dashboard
├── server.js           # Main server file
├── package.json        # Dependencies
└── .gitignore          # Ignored files

```

## 🚀 How to Run
```bash
# Install dependencies
npm install

# Start Memurai/Redis
memurai-cli start

# Run the server
node server.js
```

Visit: **[http://localhost:3000](http://localhost:3000)**

Lab 4 Completed — November 13, 2026
