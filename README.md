# puppeteer-qr-service

A small Express service that launches Puppeteer, opens the NDC payment page with a session ID, and returns the rendered QR code.

## Run locally

```bash
npm install
npm start
```

Then call:

```bash
http://localhost:3000/get-qr?sessionId=YOUR_SESSION_ID
```

## Docker

Build and run locally:

```bash
docker build -t puppeteer-qr-service .
docker run -p 3000:3000 puppeteer-qr-service
```

## Railway deploy

1. Push the repo to GitHub.
2. Open Railway and create a new project.
3. Select "Deploy from GitHub".
4. Connect this repository.
5. Railway will detect the Dockerfile and deploy automatically.
