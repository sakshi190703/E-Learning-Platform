# 📚 E-Learning Platform

A web-based platform for students and instructors to manage assignments, quizzes, and courses. Built with **Node.js**, **Express**, **MongoDB**, and **EJS**.

---

## 🚀 Features

### 👩‍🏫 Instructor
- Manage student accounts
- Create, edit, and delete assignments
- View and grade student submissions

### 👩‍🎓 Student
- Register and login
- View available assignments
- Submit solutions and view results
- Participate in quizzes
- Enroll in courses

### 🔐 Authentication & Security
- Secure login with `passport-local`
- Session management using `express-session` and `connect-mongo`
- Flash messages for errors and success

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB (Mongoose)
- **Templating:** EJS, ejs-mate
- **Authentication:** Passport.js
- **Session Store:** connect-mongo
- **File Uploads:** fs (local uploads)
- **Other:** method-override, connect-flash

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SakshiAlgoX/E-Learning-Platform.git
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the root directory.
   - Add the following:
     ```
     MONGO_URL=your_mongodb_connection_string
     SESSION_SECRET=your_session_secret
     NODE_ENV=development
     PORT=3000
     ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access the app:**
   - Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗂️ Project Structure

```
eLearningPlatform/
├── app.js
├── models/
├── routes/
├── views/
├── public/
├── uploads/
├── .env
└── README.md
```