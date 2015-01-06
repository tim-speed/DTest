// This test is for async functions

/**
 * Divides two numbers.
 * @param {number} a - var a.
 * @param {number} b - var b.
 * @param {function} cb - callback that receives error (string or null), followed by result (number or undefined)
 * @test 1 0 (typeof string)
 * @test 4 2 (=== null, === 2)
 */
function asyncDivide(a, b, cb) {
    if (!b)
        return setTimeout(function() { cb('Divide by zero error'); });
    else
        return setTimeout(function() { cb(null, a / b); });
}

/**
 * Asynchronous multiplication
 * @param {number}   a  var a
 * @param {function} cb callback receiving one number arg
 * @param {number}   b  var b
 * @test 4 (=== 8) 2
 */
function asyncMultiply(a, cb, b) {
    return setTimeout(function() { cb(a * b); });
}

/**
 * Asynchronous timeout testing
 * @param {function} cb callback receiving nothing
 * @test ()<5
 * @test ()<100
 * @test ()!
 */
function asyncTimeout(cb) {
    setTimeout(cb, 6);
}