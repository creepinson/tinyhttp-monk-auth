import { Request, Response, NextFunction, AsyncHandler } from "@tinyhttp/app";
import monk, { IMonkManager } from "monk";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthenticationConfig, UserRequest } from "./types";

export function isAsync(fn: any) {
	return fn.constructor.name === "AsyncFunction";
}

/**
 * Creates a connection to the sepcified mongodb database and returns the authentication middleware.
 * @param dbUri The mongodb database URI to connect to.
 * @returns A promise that returns login, auth, and register middleware function,
 * as well as the original config data passed in.
 */
export const createConnection = async (dbUri: string, config: AuthenticationConfig) => {
	return monk(dbUri).then((db) => useConnection(db, config));
};

/**
 * Attaches to an existing connection to a mongodb database returns the authentication middleware.
 * @param db An existing monk connection.
 * @returns A promise that returns login, auth, and register middleware function,
 * as well as the original config data passed in.
 */
export const useConnection = (db: IMonkManager, config: AuthenticationConfig) => {
	const users = db.get("users");

	const findUser = async (username: string, password: string) => {
		password = await bcrypt.hash(password, config.saltRounds!);
		const user = await users.findOne({ username, password });
		if (!user) throw new Error("user does not exist");
		const isMatch = bcrypt.compareSync(password, user.password);
		if (!isMatch) throw new Error("invalid credentials");
		return user;
	};

	const generateToken = async (user: any) => {
		return await jwt.sign({ _id: user._id.toString() }, config.secret!);
	};

	const userToJson = (user: any): any => {
		delete user.password;
		return user;
	};

	const auth: AsyncHandler = async (req: UserRequest, res: Response, next?: NextFunction) => {
		try {
			let authHeader = req.headers["Authorization"];
			if (!authHeader) {
				res.status(400).send({ error: "Invalid authentication token" });
				return;
			}

			const token = authHeader!.toString().replace("Bearer ", "");
			const decode: any = await jwt.verify(token, config.secret!);
			const user = await users.findOne({ _id: decode._id });
			if (!user) {
				res.status(404).send({ error: "User not found" });
				return;
			}
			req.user = user;
			return next!();
		} catch (error) {
			res.status(500).send({ error: error.toString() });
			return;
		}
	};
	const login: AsyncHandler = async (req: UserRequest, res: Response) => {
		try {
			const user = await findUser(req.body[config.usernameField!], req.body.password);
			const result = await bcrypt.compare(req.body.password, user.password);
			if (!result) throw new Error("Invalid credentials");
			if (!user) throw new Error("User not found");
			const token = await generateToken(user);
			res.status(200).send({ user: userToJson(user), token });
			return;
		} catch (error) {
			res.status(400).send({ error: error.toString() });
			return;
		}
	};
	const register: AsyncHandler = async (req: UserRequest, res: Response) => {
		try {
			const user = isAsync(config.generateUser!)
				? await config.generateUser!({
						...req.body,
						password: await bcrypt.hash(req.body.password, config.saltRounds!),
				  })
				: config.generateUser!({
						...req.body,
						password: await bcrypt.hash(req.body.password, config.saltRounds!),
				  });

			const newUser = await users.insert(user);
			console.log(newUser);
			const token = await generateToken(newUser);
			res.status(201).send({ user: userToJson(newUser), token });
			return;
		} catch (error) {
			res.status(400).send({ error: error.toString() });
			return;
		}
	};
	return {
		config,
		db,
		users,
		findUser,
		generateToken,
		userToJson,
		auth,
		register,
		login,
	};
};

export * from "./types";
