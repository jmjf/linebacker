export function isPrismaConnectError(error: any): boolean {
	// Prisma error codes that indicate connection failures
	// P1000 (auth); P1001 (unreachable); P1002 (server timeout);
	// P1008 (timeout); P1010 (access denied); P1011 (TLS failure);
	// P1017 (server closed connection)
	return false;
}
