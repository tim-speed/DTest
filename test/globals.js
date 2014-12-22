
var randomVar = Math.random();

/**
 * Represents a book.
 * @constructor
 * @param {string} title - The title of the book.
 * @param {string} author - The author of the book.
 * @test "Jimmy's great adventure" "John Doe" typeof object
 * @test undefined undefined !
 */
function Book(title, author) {
    if (typeof title === 'string' && typeof author === 'string') {
        return {
            title: title,
            author: author
        };
    } else {
        return null;
    }
}

/**
 * Represents a book.
 * @param {string} title - The title of the book.
 * @param {string} author - The author of the book.
 */
function BookLearningNoTest(title, author) {
    if (typeof title === 'string' && typeof author === 'string') {
        return {
            title: title,
            author: author
        };
    } else {
        return null;
    }
}

/**
 * Adds two numbers.
 * @param {number} a - var a.
 * @param {number} b - var b.
 * @test 1 2 === 3
 * @test -10 10 === 0
 */
function Add(a, b) {
    return a + b;
}

/**
 * Returns a random number generated at runtime
 * @test typeof number
 */
function Random() {
    return randomVar;
}