# Simple Static Web Project

A minimal static web project containing `index.html`, `style.css`, and `app.js`.

## Contents
- `index.html` — main HTML file
- `style.css` — styles
- `app.js` — JavaScript

## Prerequisites
- A modern web browser
- (Optional) Python or any static file server to serve files over HTTP

## Run locally
1. Open `index.html` directly in a browser.
2. Or serve with a simple HTTP server (recommended for features like fetch):

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

## Git / GitHub
Initialize and push this project to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
# create a repo on GitHub and add remote, e.g.:
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

Replace the remote URL above with your repository URL.

## License
This project is provided as-is. Add a license file if desired.
