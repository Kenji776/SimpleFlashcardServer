// src/server.js
import axios from "axios";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs/promises";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { initDb, logScore, getScores } from "./scores.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 50 }));

const PORT = process.env.PORT || 3000;
const SERVER_PASSWORD = process.env.SERVER_PASSWORD;
const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const cardsDirectory = "decks";
app.use(
	"/mascot-media",
	cors(),
	express.static(path.join(__dirname, "mascots"))
);
initDb();

// --- Shared Utility Functions ---
function validatePassword(providedPassword) {
	return true;
	return providedPassword === SERVER_PASSWORD;
}

async function askChatGPT(prompt) {
	const response = await axios.post(
		"https://api.openai.com/v1/chat/completions",
		{ model: "gpt-4", messages: [{ role: "user", content: prompt }] },
		{
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);
	return response.data;
}

async function getDeckBySlug(slug) {
	const safeSlug = path.normalize(slug).replace(/^([\.\/\\])+/, "");
	const fullPath = path.resolve(cardsDirectory, safeSlug);
	const baseDir = path.resolve(cardsDirectory);
	if (!fullPath.startsWith(baseDir)) throw new Error("Invalid deck path");
	const fileContent = await fs.readFile(fullPath, "utf-8");
	return JSON.parse(fileContent);
}

// --- Centralized Route Handler ---
async function handleRequest(handler, req, res) {
	try {
		const password = req.query.password || req.headers["x-server-password"];
		logRequest(req, handler.name || "anonymous"); // Add this line to log every request

		if (!validatePassword(password)) {
			console.warn(
				`❌ Unauthorized access attempt from ${req.ip || "unknown IP"}`
			);
			return res
				.status(403)
				.json({
					success: false,
					message: "Forbidden: Invalid password.",
				});
		}

		await handler(req, res);
	} catch (err) {
		console.error("❌ Error in handler:", err);
		res.status(500).json({
			success: false,
			message: "Internal server error.",
		});
	}
}

// --- Route Definitions ---
const routes = [
	{
		method: "get",
		path: "/api/deck",
		handler: async (req, res) => {
			const slug = req.query.slug;
			if (!slug) throw new Error("Missing slug parameter");
			const deck = await getDeckBySlug(slug);
			res.json({ success: true, data: deck });
		},
	},
	{
		method: "get",
		path: "/api/announce",
		handler: async (req, res) => {
			const userName = req.query.username;
			if (!userName) throw new Error("Missing username parameter");
			res.json({
				success: true,
				message: `Hello ${userName}, connection established.`,
			});
		},
	},
	{
		method: "post",
		path: "/api/score",
		handler: async (req, res) => {
			const {
				deckId,
				performanceRecordId,
				player = "Anonymous",
				correctPercent = 0,
			} = req.body;
			if (!deckId || !performanceRecordId)
				throw new Error("Missing required fields.");
			const result = await logScore(
				deckId,
				correctPercent,
				performanceRecordId,
				player
			);
			res.json({ success: true, data: result });
		},
	},
	{
		method: "get",
		path: "/api/scores",
		handler: async (req, res) => {
			const deckId = req.query.deck;
			if (!deckId) throw new Error("Missing deck ID");
			const scores = await getScores(deckId);
			res.json({ success: true, data: scores });
		},
	},
	{
		method: "post",
		path: "/api/text-to-speech",
		handler: async (req, res) => {
			const { text, voiceId = "EXAVITQu4vr4xnSDxMaL" } = req.body;

			if (!text) throw new Error("Missing text parameter");
			if (!voiceId) throw new Error("Missing voiceId parameter");

			const response = await axios.post(
				`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
				{
					text,
					model_id: "eleven_monolingual_v1",
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.75,
					},
				},
				{
					responseType: "arraybuffer",
					headers: {
						"xi-api-key": ELEVEN_LABS_API_KEY,
						"Content-Type": "application/json",
					},
				}
			);

			res.set("Content-Type", "audio/mpeg");
			res.send(response.data);
		},
	},
	{
		method: "get",
		path: "/api/chat",
		handler: async (req, res) => {
			const prompt = req.query.prompt;
			if (!prompt) throw new Error("Missing prompt parameter");
			const chatResponse = await askChatGPT(prompt);
			res.json({ success: true, data: chatResponse });
		},
	},
	{
		method: "get",
		path: "/api/mascots",
		handler: async (req, res) => {
			const folderPath = path.join(__dirname, "mascots");
			const entries = await fs.readdir(folderPath, {
				withFileTypes: true,
			});
			const mascots = [];
			for (const entry of entries) {
				if (entry.isDirectory()) {
					try {
						await fs.access(
							path.join(folderPath, entry.name, "mascot.settings")
						);
						mascots.push(entry.name);
					} catch (_) {}
				}
			}
			res.json({ success: true, mascots });
		},
	},
	{
		method: "get",
		path: "/api/decks",
		handler: async (req, res) => {
			try {
				const absolutePath = path.resolve("cardLibrary.json");
				const fileContent = await fs.readFile(absolutePath, "utf-8");
				const decks = JSON.parse(fileContent);

				res.json({ success: true, data: decks });
			} catch (error) {
				console.error(`❌ Error reading JSON file:`, error.message);
				res.status(500).json({
					success: false,
					message: "Failed to load decks",
				});
			}
		},
	},
	{
		method: "get",
		path: "/mascots/:folderName",
		handler: async (req, res) => {
			const folderName = req.params.folderName;
			if (folderName.includes("..") || folderName.includes("/"))
				return res.status(400).json({
					success: false,
					message: "Invalid mascot folder name",
				});
			const filePath = path.join(
				__dirname,
				"mascots",
				folderName,
				"mascot.settings"
			);
			if (
				!path
					.resolve(filePath)
					.startsWith(path.resolve(__dirname, "mascots"))
			)
				return res
					.status(403)
					.json({ success: false, message: "Forbidden path access" });
			try {
				const fileData = await fs.readFile(filePath, "utf-8");
				res.setHeader("Content-Type", "application/json");
				res.send(fileData);
			} catch (err) {
				res.status(404).json({
					success: false,
					message: "Mascot settings not found",
				});
			}
		},
	},
	{
		method: "get",
		path: "/mascot-media/:mascotName/:mediaType/:mediaName",
		handler: async (req, res) => {
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

				console.log(
					"➡️ Resolved file path inside mascot folder: ",
					fileRelativePath
				);

				// Security check
				if ([mascotName, fileRelativePath].some((val) => val.includes(".."))) {
					console.warn("⚠️ Directory traversal attempt detected");
					return res
						.status(400)
						.json({ success: false, message: "Invalid path." });
				}

				// Build and resolve the absolute file path
				const filePath = path.join(
					__dirname,
					"mascots",
					mascotName,
					fileRelativePath
				);
				console.log("➡️ Attempting to serve file from: ", filePath);

				if (!fs.existsSync(filePath)) {
					console.warn("❌ File not found at path: ", filePath);
					return res
						.status(404)
						.json({ success: false, message: "File not found." });
				}

				console.log("✅ File found. Sending: ", filePath);
				res.sendFile(filePath);
			} catch (err) {
				console.error("❌ Error serving media file:", err);
				res.status(500).json({
					success: false,
					message: "Failed to serve media file.",
				});
			}
		},
	},
];

// --- Register Routes ---
routes.forEach(({ method, path, handler }) => {
	app[method](path, (req, res) => handleRequest(handler, req, res));
});

function logRequest(req, handlerName) {
	console.log(
		`[${new Date().toISOString()}] 🚦 ${req.method} ${req.originalUrl}`
	);
	console.log(`➡️ Handler: ${handlerName}`);
	if (Object.keys(req.query).length > 0)
		console.log(`🔎 Query Params:`, req.query);
	if (req.body && Object.keys(req.body).length > 0)
		console.log(`📦 Body:`, req.body);
	console.log("---------------------------------------------");
}

// --- Start ---
app.listen(PORT, () => {
	console.log(
		`FlashCard server running at http://localhost:${PORT}`
	);
});
