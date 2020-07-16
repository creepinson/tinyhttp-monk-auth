import { App, NextFunction, Request, Response } from "@tinyhttp/app";
import fs from "fs";
const { readFile } = fs.promises;
import logger from "@tinyhttp/logger";
import { cors } from "@tinyhttp/cors";
import bodyParser from "body-parser";
import { createConnection, UserRequest } from "../../tinyhttp-monk-auth";

createConnection("mongodb://localhost/tinyhttp-test", {})
	.then(async ({ config, login, auth, register }) => {
		const app = new App();
		app.use(cors({}));
		app.use(logger());
		// app.use(jwt({ secret: config.secret!, algorithm: "HS256" }));
		app.use(bodyParser.json());
		app.use(
			bodyParser.urlencoded({
				extended: false,
			}),
		);

		app.get("/", async (_, res, next) => {
			let file;

			try {
				file = await readFile(`${process.cwd()}/test.txt`);
			} catch (error) {
				res.status(500).send({ error });
			}
			res.send(file?.toString());
		});

		app.get("/profile", auth, (req: UserRequest, res: Response) => {
			res.status(200).send({ user: req.user });
		});

		app.post("/login", (req, res, next) => res.send("hello login"));
		app.post("/register", register);

		app.use((req, res) => {
			res.status(404).send(`
			<h1>Not Found</h1>
			<p>${req.url} was not found on the server.</p>
			`);
		});
		app.listen(8080, () => console.log(`Listening on :8080`));
	})
	.catch(console.error);
