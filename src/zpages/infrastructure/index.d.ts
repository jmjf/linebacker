import { RequestHandler } from 'express';

export interface RequestStats {
	requestCount: number;
	responseCount: number;
	responsesByStatus: object;
}

export function buildTrackRequestStats(): RequestHandler;
export function getRequestStats(): RequestStats;
