// src/openai-connector.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Ideally, use an environment variable for your API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function sendRequest(prompt) {
	console.log("➡️ Sending message to OpenAI with prompt:", prompt);

	const requestBody = {
		model: "gpt-4o",
		messages: [
			{
				role: "user",
				content: prompt,
			},
		],
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

module.exports = {
	sendRequest,
};
