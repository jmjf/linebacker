const accountUriTestRE = new RegExp(`^https://[a-z0-9]{3,24}.queue.core.windows.net`, 'i');
const accountUri = `https://test123.queue.core.windows.net`;

function accountUriTest2(s: string) {
	return new RegExp(`^https://[a-z0-9]{3,24}.queue.core.windows.net`, 'gi').test(s);
}

function accountUriTest3(s: string) {
	return accountUriTestRE.test(s);
}

function isValidString(s: unknown): boolean {
	return !!s && typeof s === 'string' && s.length > 0;
}

export function reproTest() {
	//const accountUri = process.env.AZURE_QUEUE_ACCOUNT_URI as string;
	const authMethod = process.env.AUTH_METHOD as string;
	const isValid = isValidString(accountUri);
	const isADCC = authMethod === 'ADCC';
	const isUriOk1 = /^https:\/\/[a-z0-9]{3,24}.queue.core.windows.net/gi.test(accountUri); // passes
	const isUriOk2 = accountUriTest2(accountUri); // passes
	const isUriOk3 = accountUriTest3(accountUri); // fails

	if (!isValid || (isADCC && !isUriOk1)) {
		return {
			result: 'err',
			isValid,
			authMethod,
			isADCC,
			accountUri,
			isUriOk1,
			isUriOk2,
			isUriOk3,
		};
	}
	return {
		result: 'ok',
		isValid,
		authMethod,
		isADCC,
		accountUri,
		isUriOk1,
		isUriOk2,
		isUriOk3,
	};
}
