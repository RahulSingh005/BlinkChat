# BlinkChat- A Chatting App

* A full-stack **Chat Application** built with the **MERN stack** (MongoDB, Express.js, React.js, Node.js) and **Socket.io** for seamless, real-time messaging. 
* The features includes user authentication, real-time communication, and a fully responsive UI optimized for both desktop and mobile devices.

## UI
![Screenshot (194)](https://github.com/user-attachments/assets/bf90edc5-bee3-4d34-8b6f-8d7a8ead6612)
![Screenshot (192)](https://github.com/user-attachments/assets/9b17b15d-7e1b-428f-b76b-300f8a996e33)
![Screenshot (193)](https://github.com/user-attachments/assets/b0aa58dd-df3f-4b57-b390-709d0dc43ff8)

## Live Link: https://blinkchat-j4lg.onrender.com/login


## Features

- JWT-based user authentication  
- Real-time chat updates via Socket.io  
- Cloudinary integration for profile image uploads  
- Responsive and mobile-friendly UI with DaisyUI  
- Instant notifications with react-hot-toast  
- RESTful API with Express & MongoDB  
- Persistent login using cookies  
- Modern routing with React Router DOM v7
- Light/Dark theme support via DaisyUI themes

## Tech Stack

### Frontend

React.js, DaisyUI, React Router DOM v7, Axios, Socket.io-client, Lucide-react, React-hot-toast

### Backend

Node.js, Express.js, MongoDB, Socket.io v4.8.1, JWT, Bcrypt.js, Cloudinary, Cookie-parser, CORS

## Getting Started

To get started follow these steps:

#### Cloning the Repository

Using CLI

```bash
git clone https://github.com/smRid/Real-time-Chat-App.git
```

**Ensure you have installed [Git](https://git-scm.com) on your machine.**

Using GitHub:

* Click on the Green button in Github Repository and download it in Zip File


## Installation


### Setup .env file
```bash
MONGODB_URI=...
PORT=5001
JWT_SECRET=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

NODE_ENV=development
```

Install the project dependencies using npm install

### Build the app

```bash
npm run build
```
Ensure you have installed Node.js on you Machine

### Start the app

```bash
npm run start
```

Navigate to http://localhost:5001 in your browser to access the local development server.

