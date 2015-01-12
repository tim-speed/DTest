
/**
 *
 */

var Generator = require('generate-js');

var Mike = Generator.generate(
    function Mike (argument) {
        // body...
    },
    function(){

    }
);


Mike.definePrototype({},{
    /**
     * [talk description]
     * @return {[type]} [description]
     * @test === 'hello'
     */
    talk: function() {
        return 'hello';
    }
});

Mike.definePrototype({
    /**
     * [talk description]
     * @return {[type]} [description]
     * @test === 'helo'
     */
    speak: function() {
        return 'hello';
    }
});
