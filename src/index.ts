import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import { app as main } from './app'
import { auth } from './auth'
import { lucia } from "./lib/auth.js";
import { Session, User } from 'lucia';

const app = new Hono()

app.use('*', async (c, next) => {
	const sessionId = lucia.readSessionCookie(c.req.header('cookie') ?? "");
	if (!sessionId) {
        c.set('user', null);
        c.set('session', null);
		return next();
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize());
	}
	if (!session) {
		c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize());
	}
	c.set('session', session);
	c.set('user', user);
	return next();
});

app.route('/', main)
app.route('/auth', auth)

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

declare module 'hono' {
    interface ContextVariableMap {
        user: User | null
        session: Session | null
    }
}