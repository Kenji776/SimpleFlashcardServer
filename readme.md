# 📚 Simple Flashcard Server

This is the **Node.js backend server** for the **Simple Flashcard App**, responsible for providing flashcard decks, mascot images, and integrating with third-party APIs like **OpenAI** and **ElevenLabs** to generate dynamic content.

## 🚀 Features

- Serves **flashcard decks** based on predefined categories and groups
- Supports **score tracking** for players and decks
- Hosts **mascot images** for use in the UI
- Integrates with:
  - **OpenAI API** (for generating dynamic questions or prompts)
  - **ElevenLabs API** (for generating voice responses or audio)

## 🛠️ Tech Stack

- Node.js
- Express.js
- Local JSON storage for decks and scores
- OpenAI and ElevenLabs API connectors
- RESTful API for your frontend to consume

## 🗂️ Folder Structure Overview

\`\`\`
project-root/
├── server.js                # Main server file
├── scores.js                 # Handles score storage and retrieval
├── openai-connector.js       # Handles OpenAI API requests
├── elevenlabs.js             # Handles ElevenLabs API requests
├── cardLibrary.json          # Stores the flashcard deck definitions
├── scores.json               # Local JSON file for persisting scores
├── mascots/                  # Folder containing mascot images
├── decks/                    # Folder containing deck content
├── .env                      # Environment variables (not checked into Git)
└── .gitignore                # Excludes node_modules/, .env, etc.
\`\`\`

## ⚙️ Installation

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Configure Environment Variables

Create a \`.env\` file in the project root:

\`\`\`bash
ELEVENLABS_API_KEY=your-elevenlabs-api-key
OPENAI_API_KEY=your-openai-api-key
\`\`\`

> ⚠️ Keep your API keys **secure**. The \`.env\` file is included in \`.gitignore\`.

### 4. Run the Server

\`\`\`bash
node server.js
\`\`\`

The server runs by default on **\`http://localhost:3000/\`**.

## 🛡️ API Endpoints

| Endpoint                                 | Method | Description                                      |
|------------------------------------------|--------|--------------------------------------------------|
| \`/mascots/<mascot_name>\`                 | GET    | Serves mascot images                             |
| \`/decks\`                                 | GET    | Lists available decks and categories             |
| \`/decks/:slug\`                           | GET    | Retrieves the cards from a specific deck         |
| \`/scores\`                                | GET    | Returns all recorded scores                      |
| \`/scores\`                                | POST   | Submits a new score                              |
| \`/speak\`                                 | POST   | Generates speech using ElevenLabs                |
| \`/generate\`                              | POST   | Generates prompts or content using OpenAI        |

## 🧑‍💻 Development Notes

- **Deck content** is stored in \`/decks/*.cards\` files, mapped in \`cardLibrary.json\`.
- **Mascot images** are static files under \`/mascots/\`.
- **Scores** are persisted locally in \`scores.json\`. Future versions may move to a database.
- External API requests are abstracted in their respective modules:
  - \`openai-connector.js\`
  - \`elevenlabs.js\`


## ✅ Example API Request

\`\`\`bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Generate a pharmacy question"}'
\`\`\`
