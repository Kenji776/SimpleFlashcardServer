// src/server.js
import axios  from "axios";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { initDb, logScore, getScores } from "./scores.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3000;
const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const cardsDirectory = 'decks';

initDb();

export async function askChatGPT(prompt) {
    console.log("➡️ Sending message to OpenAI with prompt:", prompt);

    const requestBody = {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
    };

    try {
        const response = await axios({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            data: requestBody,
        });

        console.log(
            "✅ OpenAI response:",
            JSON.stringify(response.data, null, 2)
        );

        return {
            success: true,
            response: response.data,
            message: "Operation successful",
        };
    } catch (error) {
        console.error(
            "❌ Error in OpenAI request:",
            error.response ? error.response.data : error.message
        );

        return {
            success: false,
            message: error.message,
            response: error.response ? error.response.data : null,
        };
    }
}

// ---- Auth Token Validation ----
function getAuthToken() {
	return Date.now() - Math.floor((42131 / 3) * 8);
}

function validateRequest(providedToken) {
	const authToken = getAuthToken();
	const token = Number(providedToken);

	if (!token || isNaN(token)) return false;
	const valid = token >= authToken - 10000 && token <= authToken + 10000;
	return valid;
}

async function getFromChatGPT(prompt) {
	console.log(`Sending to ChatGPT: ${prompt}`);

	if (!prompt) throw new Error("Missing prompt parameter");

	const chatResponse = await askChatGPT(prompt);
	if (!chatResponse.success) throw new Error(chatResponse.message);

	return chatResponse;
}

async function getDecks() {
	try {
		const absolutePath = path.resolve("cardLibrary.json");
		const fileContent = fs.readFileSync(absolutePath, "utf-8");
		return JSON.parse(fileContent);
	} catch (error) {
		console.error(`Error reading JSON file:`, error.message);
		throw error;
	}
}

// Get a specific deck JSON by its slug (e.g., "IntroToPharmacy1/groupA.cards")
export async function getDeckBySlug(slug) {
	try {
		const safeSlug = path.normalize(slug).replace(/^(\.\.[\/\\])+/, "");
		const fullPath = path.resolve(cardsDirectory, safeSlug);

		console.log(`📂 Reading deck from ${fullPath}`);

		// ✅ Sync read, no callback issues
		const fileContent = fs.readFileSync(fullPath, "utf-8");

		const deckJson = JSON.parse(fileContent);
		return deckJson;
	} catch (err) {
		console.error(`⚠️ Failed to load deck for slug "${slug}":`, err);
		throw new Error(`Deck not found for slug: ${slug}`);
	}
}

async function getDeckScores(deckId) {
	try {
        if (!deckId) {
            console.error(`Missing Deck Id`);
            throw new Error('Missing Deck Id');
		}
		const scores = await getScores(deckId);
		return scores;
	} catch (error) {
		console.error(`Error getting deck scores:`, error.message);
        throw error;
	}
}

async function postNewScore(scoreData) {
	console.log(`🔧 postNewScore() called with data:`, scoreData);

	if (!scoreData || !scoreData.deckId || !scoreData.performanceRecordId) {
		console.warn(`⚠️ Missing required fields in scoreData:`, scoreData);
		throw new Error(
			"Missing required fields: deckId and performanceRecordId"
		);
	}

	const deckId = scoreData.deckId;
	const uniqueId = scoreData.performanceRecordId;
	const playerName = scoreData.player || "Anonymous";

	// Determine the score to log
	const score =
		typeof scoreData.correctPercent === "number"
			? scoreData.correctPercent
			: scoreData.runningTotalScore || 0;

	console.log(
		`➡️ Logging score for player "${playerName}" on deck "${deckId}" with score: ${score} and uniqueId: ${uniqueId}`
	);

	// Save to the DB
	const result = await logScore(deckId, score, uniqueId, playerName);

	console.log(`✅ Score logged successfully:`, result);

	return result;
}



app.get("/api/deck", async (req, res) => {
	console.log(`GET ${req.method} /api/deck with params:`, req.query);

	const response = {
		success: true,
		message: "run successful",
		urlParams: req.query,
		data: null,
	};

	try {
		const slug = req.query.slug;
		if (!slug) throw new Error("Missing slug parameter");

		response.data = await getDeckBySlug(slug);
	} catch (err) {
		console.error("❌ Error loading deck:", err);
		response.success = false;
		response.message = err.message;
	}

	console.log("Sending Deck Response");
	console.log(response.data);

	res.json(response);
});

app.get("/api/announce", (req, res) => {
	const userName = req.query.username;
	console.log(`🔔 ${userName} has connected.`);
	if (!userName) {
		return res
			.status(400)
			.json({ success: false, message: "Missing username" });
	}

	res.json({
		success: true,
		message: `Hello ${userName}, connection established.`,
	});
});

app.get("/api/mascots", async (req, res) => {
	try {
		const folderPath = path.join(__dirname, "mascots");
		const mascotFolders = fs
			.readdirSync(folderPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory());

		const mascots = [];

		for (const folder of mascotFolders) {
			const settingsPath = path.join(
				folderPath,
				folder.name,
				"mascot.settings"
			);
			if (fs.existsSync(settingsPath)) {
				mascots.push(folder.name);
			}
		}

		res.json({ success: true, mascots });
	} catch (err) {
		console.error("❌ Error reading mascots folder:", err);
		res.status(500).json({ success: false, message: err.message });
	}
});

// Serve a mascot by filename
app.get("/mascots/:folderName", async (req, res) => {
	try {
		const folderName = req.params.folderName;

		// SECURITY CHECK: Prevent directory traversal
		if (folderName.includes("..") || folderName.includes("/")) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Invalid mascot folder requested.",
				});
		}

		const filePath = path.join(
			__dirname,
			"mascots",
			folderName,
			"mascot.settings"
		);

		if (!fs.existsSync(filePath)) {
			return res
				.status(404)
				.json({
					success: false,
					message: "Mascot settings file not found.",
				});
		}

		const fileData = await fs.promises.readFile(filePath, "utf-8");

		res.setHeader("Content-Type", "application/json");
		res.send(fileData);
	} catch (err) {
		console.error("❌ Error loading mascot file:", err);
		res.status(500).json({
			success: false,
			message: "Failed to load mascot file.",
		});
	}
});

// This matches ANY path starting with /mascot-media/
app.get("/mascot-media/:mascotName/:mediaType/:mediaName", async (req, res) => {
    try {
        console.log("🔍 Incoming mascot media request");
        console.log("➡️ Full request path: ", req.path);
        console.log("➡️ Original URL: ", req.originalUrl);
        console.log("➡️ Mascot name param: ", req.params.mascotName);
        console.log("➡️ Media type: ", req.params.mediaType);
        console.log("➡️ Media name param: ", req.params.mediaName);

        const mascotName = req.params.mascotName;

        // Manually remove `/mascot-media/${mascotName}/` from originalUrl
        const prefix = `/mascot-media/${mascotName}/`;
        const fileRelativePath = req.originalUrl.startsWith(prefix)
            ? req.originalUrl.slice(prefix.length)
            : "";

        console.log("➡️ Resolved file path inside mascot folder: ", fileRelativePath);

        // Security check
        if ([mascotName, fileRelativePath].some((val) => val.includes(".."))) {
            console.warn("⚠️ Directory traversal attempt detected");
            return res.status(400).json({ success: false, message: "Invalid path." });
        }

        // Build and resolve the absolute file path
        const filePath = path.join(__dirname, "mascots", mascotName, fileRelativePath);
        console.log("➡️ Attempting to serve file from: ", filePath);

        if (!fs.existsSync(filePath)) {
            console.warn("❌ File not found at path: ", filePath);
            return res.status(404).json({ success: false, message: "File not found." });
        }

        console.log("✅ File found. Sending: ", filePath);
        res.sendFile(filePath);
    } catch (err) {
        console.error("❌ Error serving media file:", err);
        res.status(500).json({ success: false, message: "Failed to serve media file." });
    }
});

//------ Default POST Router ------//
app.post("/", async (req, res) => {
	console.log(`📥 Received POST / request`);
	console.log(`🔍 Query Params:`, req.query);
	console.log(`🔍 Request Headers:`, req.headers);
	console.log(`🔍 Request Body:`, req.body);

	const action = req.query.action;
	const authToken = req.query.authToken || req.headers.authorization;

	const response = {
		success: true,
		message: "run successful",
		requestedAction: action,
		urlParams: req.query,
		data: null,
	};

	try {
		if (action === "post_score") {
			console.log(`➡️ Action is post_score. Proceeding to log score.`);

			// Pass the entire body to postNewScore()
			const result = await postNewScore(req.body);

			console.log(`✅ postNewScore() returned:`, result);

			response.data = result;
		} else {
			console.warn(`⚠️ Unknown action: ${action}`);
			response.success = false;
			response.message = `Unknown action: ${action}`;
		}
	} catch (err) {
		console.error("❌ Error occurred in POST handler:", err);
		response.success = false;
		response.message = err.message;
	}

	console.log(`🔚 Responding to client with:`, response);
	res.json(response);
});

// ---- Default Get Router ----
app.get("/", async (req, res) => {
	console.log(`GET ${req.method} / with params:`, req.query);

	const action = req.query.action;
	const authToken = req.query.authToken || req.headers.authorization;

	const response = {
		success: true,
		message: "run successful",
		requestedAction: action,
		urlParams: req.query,
		data: null,
	};

	try {
		if (!validateRequest(authToken)) {
			//throw new Error("Invalid authorization");
		}

		if (action === "get_scores") {
			const deckId = req.query.deck;
			if (!deckId) throw new Error("Missing deck parameter");
			response.data = await getDeckScores(req.query.deck);
		} else if (action === "ask_chat_gpt") {
			const prompt = req.query.prompt;
			response.data = await getFromChatGPT(prompt);
		} else if (action === "get_decks") {
			response.data = await getDecks();
		} else if (action === "get_el_auth") {
			response.data = ELEVEN_LABS_API_KEY;
		} else {
			throw new Error(`Invalid action. Provided: ${action}`);
		}
	} catch (err) {
		console.error("❌ Error:", err);
		response.success = false;
		response.message = err.message;
	}
	res.json(response);
});

// ---- Start the server ----
app.listen(PORT, () => {
	console.log(
		`🚀 FlashCard proxy server running on http://localhost:${PORT}`
	);
});
