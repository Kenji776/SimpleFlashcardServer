const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3000;
const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_LABS_BASE_URL = "https://api.elevenlabs.io/v1";

if (!ELEVEN_LABS_API_KEY) {
	throw new Error("Missing ELEVEN_LABS_API_KEY in .env file.");
}

// ----- General-purpose API Request -----
async function sendRequest(
	endpoint,
	method = "GET",
	body = null,
	responseType = "json"
) {
	const url = `${ELEVEN_LABS_BASE_URL}${endpoint}`;

	console.log(`➡️ ${method} ${url}`);
	if (body) console.log(`➡️ Body: ${JSON.stringify(body, null, 2)}`);

	try {
		const response = await axios({
			url,
			method,
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": ELEVEN_LABS_API_KEY,
			},
			timeout: 15000, // Fail fast
			data: body || undefined,
			responseType: responseType,
		});

		if (responseType === "arraybuffer") {
			console.log(
				`✅ Received binary data (${response.data.byteLength} bytes)`
			);
			return { success: true, response: response.data };
		}

		console.log(
			`✅ Response data: ${JSON.stringify(response.data, null, 2)}`
		);
		return { success: true, response: response.data };
	} catch (error) {
		console.error(`❌ ${error.message}`);
		if (error.response) {
			console.error(`Status: ${error.response.status}`);
			console.error(
				`Data: ${JSON.stringify(error.response.data, null, 2)}`
			);
		}

		return {
			success: false,
			message: error.message,
			response: error.response?.data || null,
		};
	}
}

// ----- GET /voices -----
app.get("/voices", async (req, res) => {
	const result = await sendRequest("/voices", "GET");

	if (!result.success) return res.status(500).json(result);

	const voiceMap = {};
	if (result.response && result.response.voices) {
		for (const voice of result.response.voices) {
			voiceMap[voice.name] = voice;
		}
	}

	console.log(`🔊 Available voices: ${Object.keys(voiceMap).join(", ")}`);
	res.json({ success: true, voices: voiceMap });
});

// ----- POST /text-to-speech -----
app.post("/text-to-speech", async (req, res) => {
	const { text, voiceId } = req.body;
	console.log(`📥 TTS request:`, req.body);

	if (!text || !voiceId) {
		return res
			.status(400)
			.json({ success: false, message: "Missing text or voiceId" });
	}

	const requestBody = {
		text,
		model_id: "eleven_turbo_v2", // Fastest available
		voice_settings: {
			stability: 0.25,
			similarity_boost: 0.5,
			style: 0,
			use_speaker_boost: false,
		},
	};

	// Use optimize_streaming_latency=1 (fastest) for lowest delay
	const endpoint = `/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128&optimize_streaming_latency=1`;

	// Return as binary audio stream
	const result = await sendRequest(
		endpoint,
		"POST",
		requestBody,
		"arraybuffer"
	);

	if (!result.success) return res.status(500).json(result);

	// Stream the audio directly back
	res.set({
		"Content-Type": "audio/mpeg",
		"Content-Length": result.response.byteLength,
	});
	res.send(result.response);
});

// ----- Default 404 for unknown routes -----
app.get("*", (req, res) => {
	console.log(`❓ Unknown GET route: ${req.originalUrl}`);
	res.status(404).json({
		success: false,
		message: `Unknown route: ${req.originalUrl}`,
	});
});

// ----- Start server -----
app.listen(PORT, () => {
	console.log(
		`🚀 ElevenLabs proxy server running on http://localhost:${PORT}`
	);
});
