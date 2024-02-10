import { Hono } from 'hono'
import { route as github } from './github'
import * as fs from 'fs/promises'

const app = new Hono()

app.route('/login/github', github)

app.get("/login", async (c) => {
	if (c.get('session')) {
		return c.redirect("/");
	}
	const htmlFile = await fs.readFile("src/auth/index.html");
	return c.html(htmlFile.toString("utf-8"));
});

export const auth = app