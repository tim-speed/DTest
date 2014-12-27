// Prototype based test

function theClass() {

}

/**
 * Represents a book.
 * @constructor
 * @param {string} title - The title of the book.
 * @param {string} author - The author of the book.
 * @test "Jimmy's great adventure" "John Doe" typeof object
 * @test undefined undefined !
 */
theClass.prototype.Book = function Book(title, author) {
    if (typeof title === 'string' && typeof author === 'string') {
        return {
            title: title,
            author: author
        };
    } else {
        return null;
    }
};

/**
 * Represents a book.
 * @param {string} title - The title of the book.
 * @param {string} author - The author of the book.
 */
theClass.prototype.BookLearningNoTest = function BookLearningNoTest(title, author) {
    if (typeof title === 'string' && typeof author === 'string') {
        return {
            title: title,
            author: author
        };
    } else {
        return null;
    }
};

var theOtherClass = function theOtherClass() {

};

/**
 * Adds two numbers.
 * @param {number} a - var a.
 * @param {number} b - var b.
 * @test 1 2 === 3
 * @test -10 10 === 0
 */
theOtherClass.prototype.Add = function(a, b) {
    return a + b;
};

/**
 * Returns a random number generated at runtime
 * @test typeof number
 */
theOtherClass.Random = function random() {
    return Math.random();
};
