DTest
=====

Unit tests embedded in JSDoc styled comments for JS and eventually sub-langs (TypeScript, CoffeScript, ...)

To get started look at the files in the test directory

TODO:
-----
- Generate.js support
- TypeScript support
- Readfile in doc function to specify files to read into string and potentially stream params of functions
- Dirty and Clean mode tests ( Dirty all tests are run in one environment, clean each test branch is run in it's own fresh environment ) * As an option
- Further testing and potential work on branching?
- CoffeeScript support?
- Potential implicit randomized testing based of jsdoc param and returns descriptions ( as an option ? )