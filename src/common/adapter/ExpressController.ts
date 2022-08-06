import { Request, Response } from 'express';

export const responseTypes = {
	json: 'application/json',
	text: 'text/plan',
};

export abstract class ExpressController {
	protected abstract execImpl(
		request: Request,
		response: Response
	): Promise<void | any>;

	public async execute(
		request: Request,
		response: Response
	): Promise<void | any> {
		try {
			return await this.execImpl(request, response);
		} catch (e) {
			console.log(e);
		}
	}

	// response.status(), response.type(), etc. mutate response, so we don't need to return anything

	public respondOk<T>(response: Response, dto?: T) {
		if (dto) {
			response.status(200).type(responseTypes.json);
		}
		response.status(200);
	}

	public respondAccepted<T>(response: Response, dto?: T) {
		if (dto) {
			response.status(202).type(responseTypes.json);
		}
		response.status(202);
	}

	public respondBadRequest(response: Response) {
		response.status(400).type(responseTypes.json);
	}

	public respondServerError(response: Response) {
		response.status(500).type(responseTypes.json);
	}
}
