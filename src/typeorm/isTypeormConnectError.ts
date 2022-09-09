export function isTypeormConnectError(errorAny: any): boolean {
	return (
		(errorAny.originalError &&
			errorAny.originalError.message &&
			(errorAny.originalError.message as string).toLowerCase().includes('connect')) ||
		(errorAny.driverError &&
			errorAny.driverError.name &&
			(errorAny.driverError.name as string).toLowerCase().includes('connect')) ||
		(errorAny.code && errorAny.code.toLowerCase() === 'esocket')
	);
}
