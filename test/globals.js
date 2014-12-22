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