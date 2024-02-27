import * as cdk from 'aws-cdk-lib';
import {
  aws_lambda as lambda,
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations,
  aws_apigatewayv2_authorizers,
} from 'aws-cdk-lib';
import { HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';

export class LambdaAuthorizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hello_world_fn = new lambda.Function(this, 'hello-world-fn', {
      functionName: `test-hello-world`,
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const response = {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Hello World'
            })
          };
          return response;
        };
      `),
    });

    const authHandler = new lambda.Function(this, 'agent-authorizer-fn', {
      functionName: `test-agent-authorizer`,
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
      exports.handler = async (event) => {
        console.log(process.env.INVENTORY_API_ARN, "THE ARN")
        console.log('event.methodArn', event.methodArn);
        // VALIDATE THE CREDENTIALS IN THE HEADERS BEFORE YOU RETURN isAuthorized: true!
        console.log(JSON.stringify(event))
        const response = {
          isAuthorized: true,
        };

        console.log("DONE! Returning response!", JSON.stringify(response))
        return response;
      };
      `),
    });

    const authorizer = new aws_apigatewayv2_authorizers.HttpLambdaAuthorizer(
      'BooksAuthorizer',
      authHandler,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE], // You need this in order to return a simple response like above
        authorizerName: `test-books-authorizer`, // Define if returns simple and/or iam response
        resultsCacheTtl: cdk.Duration.seconds(0), // I turned this off because when I was testing I was getting cached responses
      }
    );

    const integration = new aws_apigatewayv2_integrations.HttpLambdaIntegration(
      'inventory-fn-integration',
      hello_world_fn,
      {}
    );

    const api = new apigw.HttpApi(this, 'HttpApi', {
      defaultAuthorizer: authorizer,
      description: 'Fetches vanity names for connect callers.',
      corsPreflight: {
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.HEAD,
          apigw.CorsHttpMethod.OPTIONS,
          apigw.CorsHttpMethod.POST,
        ],
        allowOrigins: ['*'],
      },
    });

    // api.addRoutes({
    //   integration,
    //   path: '/',
    //   authorizer,
    // });
    api.addRoutes({
      integration,
      path: '/books',
      // authorizer,
    });

    new cdk.CfnOutput(this, 'API', {
      key: 'API',
      value: api.apiEndpoint,
    });
  }
}
