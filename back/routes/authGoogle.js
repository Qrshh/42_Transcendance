import  { OAuth2Client } from "google-auth-library";
import { dbGet, dbRun } from "../db/index.js";
import { generateAccessToken, generateRefreshToken } from "../utils/auth.js";

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export default async function (fastify){
	fastify.post("/auth/google", async (req, reply) => {
		const { token } = req.body;
		if(!token) return reply.code(400).send({message: "Token manquant" });

		try {
			const ticket = await client.verifyIdToken({
				idToken: token,
				audience: GOOGLE_CLIENT_ID,
			});
			const payload = ticket.getPayload();

			const googleId = payload.sub;
			const email = payload.email;
			const username = payload.name || email.split("@")[0];
			const avatar = payload.picture || "/avatars/defaut.png";

			let user = await dbGet("SELECT * FROM users WHERE google_id = ?", [googleId]);

			if(!user){
				const result = await dbRun(
					"INSERT INTO users (username, email, google_id, avatar) VALUES (?, ?, ?, ?)",
					[username, email, googleId, avatar]
				);

				user = {
					id: result.lastID,
					username, 
					email,
					google_id: googleId,
					avatar,
				};
			}

			const accessToken = generateAccessToken({userId: user.id, username: user.username});
			const refreshToken = generateRefreshToken({userId: user.id});

			return reply.send({
				user,
				tokens: {accessToken, refreshToken },
			});

		} catch (err) {
			console.error("Erreur OAuth Google:", err);
			return reply.code(401).send({message: "Token Google invalide"});
		}
	});
};