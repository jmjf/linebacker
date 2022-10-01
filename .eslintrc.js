module.exports = {
	env: {
		browser: false,
		amd: false,
		node: true,
		es2020: true,
	},
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	rules: {
		semi: ['error', 'always'],
		quotes: ['error', 'single', { allowTemplateLiterals: true }],
	},
};
