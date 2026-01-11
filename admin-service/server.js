const app = require('./app');

app.listen(process.env.PORT, function () {
  console.log(process.env.SERVICE_NAME + ' listening on port ' + process.env.PORT);
});
