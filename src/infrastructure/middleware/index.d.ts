import { ErrorRequestHandler, NextFunction, Request, RequestHandler } from 'express';

export interface TracerizerRequest extends Request {
	hrTimeTraceId: string;
}

export interface TracerizerOptions {
	reqTraceIdKey: string;
}

export interface PinomorOptions {
	log: (obj: object, msg?: string | undefined) => void;
	reqStartTimeKey: string;
	reqTraceIdKey?: string;
	reqGetStartFromKey?: string;
}

export interface JsonBodyErrorHandlerOptions {
	log: (obj: object, msg?: string | undefined) => void;
	reqTraceIdKey?: string;
}

export type CustomRequest = Request & TracerizerRequest;

declare function SyncMiddleware(req: CustomRequest, res: Response, next: NextFunction);
declare function ErrorHandlerMiddleware(err: Error, req: CustomRequest, res: Response, next: NextFunction);

export function buildTracerizer(opts: TracerizerOptions): RequestHandler;
export function buildPinomor(opts: PinomorOptions): RequestHandler;
export function buildJsonBodyErrorHandler(opts: JsonBodyErrorHandlerOptions): ErrorRequestHandler;
