# Vocabulary Voice Quiz

A voice-based English-Hebrew vocabulary quiz web app. The app speaks English words aloud and listens for your Hebrew answer using speech recognition.

**Project by [Shahar Barkai](https://www.shaharb.com)**

## Features

- **Voice-powered**: Text-to-speech reads the word, speech recognition listens for your answer
- **Two quiz modes**: English to Hebrew or Hebrew to English
- **3 built-in word lists**: Band III Lists A, C, and D (766 words total)
- **Upload your own word lists**: Upload `.docx` files with your own vocabulary
- **Smart matching**: Fuzzy matching tolerates slight pronunciation differences
- **Score tracking**: Shows results, lists missed words, option to retry
- **Confetti & encouragement**: Visual celebrations on correct answers
- **Mobile friendly**: Responsive design optimized for phone screens

## Tech Stack

- **Backend**: Node.js + Express
- **File parsing**: Mammoth (DOCX), pdfjs-dist (PDF)
- **Speech**: Web Speech API (browser built-in)
- **Security**: Helmet CSP, rate limiting, file validation, XSS sanitization
- **Process manager**: PM2

## Setup

### Prerequisites

- Node.js 18+
- nginx (for reverse proxy with SSL)

### Installation

```bash
# Clone the repo
git clone https://github.com/Shak123456/vocabulary-quiz.git
cd vocabulary-quiz

# Install dependencies
npm install

# Start the server
node server.js
```

The server runs on port 3099 by default (localhost only).

### nginx Configuration

Add a location block to your nginx config:

```nginx
location /vocabulary/ {
    proxy_pass http://127.0.0.1:3099/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 6M;
}
```

### Running with PM2

```bash
pm2 start server.js --name vocabulary
pm2 save
pm2 startup
```

## Word List Format

Upload `.docx` files containing a table with these columns:

| Expression/word | Part of speech | Hebrew | Meaning |
|----------------|---------------|--------|---------|
| aggressive | adjective | אגרסיבי | hostile, forceful |
| alarm | noun | אזעקה | a signal that warns |

The Hebrew column is required. Part of speech and Meaning are optional.

## File Structure

```
├── server.js          # Express backend with upload handling
├── public/
│   └── index.html     # Frontend (single page app with embedded word data)
├── uploads/           # Uploaded word lists (JSON, created at runtime)
├── package.json
└── README.md
```

## Best Experience

Use **Google Chrome** for the best speech recognition support.

## License

MIT
