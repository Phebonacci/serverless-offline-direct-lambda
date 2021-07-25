'use strict';

var AWS_SDK_USED = process.env.AWS_SDK_USED || 'rails';
function AWS_SDK_METHOD(functionBeingProxied, location) {
  if(AWS_SDK_USED == 'node') {

    // Support to call the function from the AWS SDK (NodeJS) directly...
    var AWS_SDK_NODE_METHOD = {
      http: {
        method: 'POST',
        cors: true,
        // This is the path to the Lambda API..
        path: `/2015-03-31/functions/${functionBeingProxied.name}/invocations`,
        request: {
          template: {
            // NB: AWS SDK for NodeJS specifies as 'binary/octet-stream' not 'application/json'
            'binary/octet-stream': JSON.stringify(
              {
                location,   
                body: "$input.body",
                targetHandler: functionBeingProxied.handler,
              }
            ),
          }
        },
        response: {
          headers: {
            "Content-Type": "application/json"
          }
        }
      }
    };
    return AWS_SDK_NODE_METHOD;

  } else {

    // Additional support to call the function from the All other SDK's (Don't ask why AWS did it like this ......)
    var AWS_SDK_RAILS_METHOD = {
      http: {
        method: 'POST',
        // This is the path to the Lambda API..
        path: `2015-03-31/functions/${functionBeingProxied.name}/invocations`,
        request: {
          template: {
            // NB: AWS SDK for NodeJS specifies as 'binary/octet-stream' not 'application/json'
            'application/json': JSON.stringify(
              {
                location,   
                body: "$input.json('$')",
                targetHandler :  functionBeingProxied.handler,
              }
            )
          }
        },
        response: {
          headers: {
            "Content-Type": "application/json"
          }
        }
      }
    };
    return AWS_SDK_RAILS_METHOD;
  }

};

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    const boundStartHandler = this.startHandler.bind(this);

    this.hooks = {
      'before:offline:start': boundStartHandler,
      'before:offline:start:init': boundStartHandler,
    };
  }

  startHandler() {
    let location = '';
    try {
      location = this.serverless.service.custom['serverless-offline'].location;
    } catch (_) { }

    location = `${this.serverless.config.servicePath}/${location}`;

    this.serverless.cli.log('Running Serverless Offline with direct lambda support');

    addProxies(this.serverless.service.functions, location);
  }
}

const addProxies = (functionsObject, location) => {
  Object.keys(functionsObject).forEach(fn => {

    // filter out functions with event config,
    // leaving just those intended for direct lambda-to-lambda invocation
    const functionObject = functionsObject[fn];
    if (!functionObject.events || !functionObject.events.some((event) => Object.keys(event)[0] === 'http')) {
      const pf = functionProxy(functionObject, location);
      functionsObject[pf.name] = pf;
    } else {
      functionsObject[fn] = {
        ...functionObject,
        handler: `${location}/${functionObject.handler}`,
      }
    }
  });
};

const functionProxy = (functionBeingProxied, location) => ({
  ...functionBeingProxied,
  name: `${functionBeingProxied.name}_proxy`,
  environment: functionBeingProxied.environment,
  events: [ 
    // See methods above for further details
    AWS_SDK_METHOD(functionBeingProxied, location)
  ],
});

module.exports = ServerlessPlugin;
