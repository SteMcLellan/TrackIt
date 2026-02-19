- Not all http methods are using the `withParticipantContext` helper
- I still don't like how the files are organized, perhaps we need something more structured.

Borrow a style from @senacor/azure-function-middleware
```ts
const httpHandler = async (request: HttpRequest, context: InvocationContext) => {
  context.info('function called');
  return { status: 201 };
};

const requestBodySchema = Joi.object().keys({
  name: Joi.string().min(3).max(30).required(),
});

app.http('example-function', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'example',
  handler: middleware(
    [requestBodyValidation(requestBodySchema)], 
    httpHandler, 
    []
  ),
});
```

Make sure all apis are updated to the same model.