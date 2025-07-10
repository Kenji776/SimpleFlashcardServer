// scores.js
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.resolve(__dirname, "scores.json");

if (!fs.existsSync(dbFile)) {
	fs.writeFileSync(
		dbFile,
		JSON.stringify({ decks: [], scores: [] }, null, 2)
	);
}

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { decks: [], scores: [] });

export async function initDb() {
	await db.read();
	db.data ||= { decks: [], scores: [] };
	await db.write();
}

export async function logScore(deckId, score, uniqueId, playerName) {
	await db.read();

	// Make sure the data object exists
	db.data ||= { decks: [], scores: [] };

	const normalizedDeckId = normalizeDeckId(deckId);

	// Safely search for an existing deck
	let deck = db.data.decks.find((d) => d.deckId === normalizedDeckId);
	if (!deck) {
		deck = {
			id: generateId(),
			deckId: normalizedDeckId,
			name: deckId,
		};
		db.data.decks.push(deck);
		console.log(`Created new deck: ${deckId}`);
	}

	// Same as before
	let existingScore = db.data.scores.find((s) => s.uniqueId === uniqueId);

	if (existingScore) {
		console.log(`Updating existing score for ${playerName}`);
		existingScore.score = score;
		existingScore.playerName = playerName;
		existingScore.deckId = deck.id;
	} else {
		console.log(`Adding new score for ${playerName}`);
		existingScore = {
			id: generateId(),
			deckId: deck.id,
			uniqueId: uniqueId,
			score: score,
			playerName: playerName,
			createdAt: Date.now(),
		};
		db.data.scores.push(existingScore);
	}

	await db.write();

	return [deck, existingScore];
}

export async function getScores(deckId) {
	await db.read();
	const normalizedDeckId = normalizeDeckId(deckId);

	// Find all decks matching the normalized deckId
	const matchingDecks = db.data.decks.filter(
		(d) => d.deckId === normalizedDeckId
	);

	if (matchingDecks.length === 0) {
		console.warn(
			`⚠️ No deck found for deckId: ${deckId} (normalized: ${normalizedDeckId})`
		);
		return [];
	}

	// Collect all the deck IDs
	const deckIds = matchingDecks.map((d) => d.id);

	console.log(`➡️ Getting scores for decks: ${deckIds.join(", ")}`);

	// Return all scores matching any of the deck IDs
	return db.data.scores
		.filter((s) => deckIds.includes(s.deckId))
		.sort((a, b) => b.score - a.score)
		.slice(0, 50);
}

function generateId() {
	return Math.random()
		.toString(36)
		.substring(2, 10);
}

function normalizeDeckId(deckId) {
	return deckId
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}