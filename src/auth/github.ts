import { Hono } from "hono"
import { getCookie, setCookie } from 'hono/cookie'
import { OAuth2RequestError, generateState } from "arctic";
import { github, lucia } from "../lib/auth.js";
import { DatabaseUser, db } from "../lib/db.js";
import { generateId } from "lucia";

interface GitHubUser {
	id: string;
	login: string;
}

export const route = new Hono()

route.get('/', async (c) => {
	const state = generateState();
	const url = await github.createAuthorizationURL(state);
    setCookie(c, "github_oauth_state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        // sameSite: "lax"
    })
	return c.redirect(url.toString());
})

route.get("/callback", async (c) => {
	const code = c.req.query('code') ?? null;
	const state = c.req.query('state') ?? null;
	const storedState = getCookie(c, 'github_oauth_state') ?? null;
	if (!code || !state || !storedState || state !== storedState) {
		console.log(code, state, storedState);
		return c.status(400)
	}
	try {
		const tokens = await github.validateAuthorizationCode(code);
		const githubUserResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`
			}
		});
		const githubUser: GitHubUser = (await githubUserResponse.json()) as GitHubUser;
		const existingUser = db.prepare("SELECT * FROM user WHERE github_id = ?").get(githubUser.id) as
			| DatabaseUser
			| undefined;

		if (existingUser) {
			const session = await lucia.createSession(existingUser.id, {});
            c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
			return c.redirect("/auth/");
		}

		const userId = generateId(15);
		db.prepare("INSERT INTO user (id, github_id, username) VALUES (?, ?, ?)").run(
			userId,
			githubUser.id,
			githubUser.login
		);
		const session = await lucia.createSession(userId, {});
		c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
        return c.redirect("/auth/");
	} catch (e) {
		if (e instanceof OAuth2RequestError && e.message === "bad_verification_code") {
			// invalid code
			return c.status(400)
		}
		return c.status(500)
	}
});

