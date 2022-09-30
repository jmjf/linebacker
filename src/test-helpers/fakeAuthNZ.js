function buildFakeAuthNZ() {
	return function fakeAuthNZ(req, res, next) {
		const authHeader = req.get('TestAuth') || '';
		const [sub, ...scopes] = authHeader.split('|');
		req.jwtPayload = { sub };
		req.clientScopes = scopes;
		next();
	};
}
module.exports = { buildFakeAuthNZ };
