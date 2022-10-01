import { ErrorRequestHandler, NextFunction, Request, RequestHandler } from 'express';
import { VerifierOptions } from 'fast-jwt';
import { TypeormClientAuthorization } from '../typeorm/entity/TypeormClientAuthorization';

export interface TracerizerOptions {
	reqTraceIdKey: string;
}

export interface TracerizerRequest extends Request {
	tracerizerTraceId: string;
}
export interface PinomorOptions {
	log: (obj: object, msg?: string) => void;
	reqStartTimeKey: string;
	reqTraceIdKey?: string;
	reqGetStartFromKey?: string;
}

export interface JsonBodyErrorHandlerOptions {
	log: (obj: object, msg?: string) => void;
	reqTraceIdKey?: string;
}

export interface AuthnerizerOptions {
	allowedIssuers: string[];
	fastjwtVerifierOptions?: Partial<VerifierOptions>;
	buildGetPublicKey: (domain: string) => (token: { kid: string; alg: string }) => Promise<string>;
	logError: (obj: object, msg?: string) => void;
	reqTraceIdKey?: string;
}

type JwtPayload = {
	iss?: string;
	sub?: string;
	aud?: string;
	iat?: number;
	nbf?: number;
	exp?: number;
	azp?: string;
	gty?: string;
	jti?: string;
};

export interface AuthnerizerRequest extends Request {
	jwtPayload: JwtPayload;
}

export interface AuthzerizerOptions {
	cacheMax?: number;
	ttlMs?: number;
	reqTraceIdKey?: string;
	logError: (obj: object, msg?: string) => void;
	getAuthZFromDb: (clientId: string) => Promise<TypeormClientAuthorization | null>;
}
export interface AuthzerizerRequest extends Request {
	clientScopes: string[];
}

export interface CustomRequest extends Request, TracerizerRequest, AuthnerizerRequest, AuthzerizerRequest {}

export function buildTracerizer(opts: TracerizerOptions): RequestHandler;
export function buildPinomor(opts: PinomorOptions): RequestHandler;
export function buildAuthnerizer(opts: AuthnerizerOptions): RequestHandler;
export function buildAuthzerizer(opts: AuthzerizerOptions): RequestHandler;

export function buildJsonBodyErrorHandler(opts: JsonBodyErrorHandlerOptions): ErrorRequestHandler;
