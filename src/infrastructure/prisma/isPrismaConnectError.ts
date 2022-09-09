export function isPrismaConnectError(error: any): boolean {
	return ['P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1011', 'P1017'].includes(error.code);
	// Prisma error codes that indicate connection failures
	// P1000 (auth); P1001 (unreachable); P1002 (server timeout);
	// P1008 (timeout); P1010 (access denied); P1011 (TLS failure);
	// P1017 (server closed connection)
}
