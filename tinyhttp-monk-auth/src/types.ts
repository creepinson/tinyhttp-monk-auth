import { Request } from "@tinyhttp/app";

export interface UserRequest extends Request {
	user?: any;
}

export class AuthenticationConfig {
    saltRounds? = 10;
    secret? = "secret1234";
    usernameField? = "username";
    generateUser?: (body: any) => any = async (body) => body;
};