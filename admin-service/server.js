// Import the Express app from app.js
const app = require('./app');

// Start the server on the port specified in environment variables
app.listen(process.env.PORT, function () {
  console.log(process.env.SERVICE_NAME + ' listening on port ' + process.env.PORT);
});
