import { Hono } from "hono";
import * as fs from "fs/promises";

export const app = new Hono()

app.get("/", async (c) => {
    const user = c.get('user')
	if (!user) {
		return c.redirect("/auth/login");
	}
	const templateFile = await fs.readFile("routes/index.template.html");
	let template = templateFile.toString("utf-8");
	template = template.replaceAll("%username%", user.username);
	template = template.replaceAll("%user_id%", user.id);
	return c.html(template);
});
