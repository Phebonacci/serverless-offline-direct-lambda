const serializeError = require('serialize-error');
const path = require('path');

async function handler(event, context, callback) {
  const { ClientContext } = event.body;

  const [targetHandlerFile, targetHandlerFunction] = event.targetHandler.split(".");
  const target = require(path.resolve(__dirname, '../..', event.location, targetHandlerFile));

  const targetContext = {
    ...context,
  };

  if (ClientContext) {
    targetContext.clientContext = JSON.parse(Buffer.from(ClientContext, 'base64'));
  }

  target[targetHandlerFunction](event.body, context, (error, response) => {

    if (error) {
        // Return Serverless error to AWS sdk
        callback(null, {
            StatusCode: 500,
            FunctionError: 'Handled',
            Payload: serializeError(error)
        })
    } else {
        // Return lambda function response to AWS SDK & pass through args from serverless.
        callback(null, response)
    }
  });


}

module.exports.handler = handler;
