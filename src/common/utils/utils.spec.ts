import { isDate } from 'util/types';
import { dateOrUndefinedAsDate } from './utils';

describe('Utils', () => {
	describe('dateOrUndefinedAsDate', () => {
		test('when passed a Date, it returns a new Date with the same value', () => {
			// Arrange
			const date = new Date();

			// Act
			const result = dateOrUndefinedAsDate(date);

			// Assert
			expect(isDate(result)).toBe(true);
			expect(result.valueOf()).toEqual(date.valueOf());
			expect(result).not.toBe(date);
		});

		test.each([
			'2001-01-01',
			'2002-02-02T02:02Z',
			'2003-03-03T03:03:03Z',
			'2005-05-05T05:05:05-05:00',
			'2006-06-06T06:06:06.006-06:00',
		])('when passed a valid date string (%p), it returns a Date', (date) => {
			// Arrange
			const expected = new Date(date);

			// Act
			const result = dateOrUndefinedAsDate(date);

			// Assert
			expect(isDate(result)).toBe(true);
			expect(result.valueOf()).toEqual(expected.valueOf());
			expect(result).not.toBe(expected);
		});

		test.each(['2004-04-04T04:04:04 GMT', 'invalid date', '', undefined, null, 700000])(
			'when passed an invalid date string (%p), it returns undefined',
			(date) => {
				// Arrange

				// Act
				const result = dateOrUndefinedAsDate(date);

				// Assert
				expect(result).toBeUndefined();
			}
		);
	});
});
