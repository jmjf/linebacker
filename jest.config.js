/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['./src'],
	testPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/src/test-helpers/tiny-kafka/'],
};
