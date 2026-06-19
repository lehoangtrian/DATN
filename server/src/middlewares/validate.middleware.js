const Joi = require('joi');

const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });

  if (error) {
    const messages = error.details.map((d) => d.message.replace(/"/g, ''));
    return res.status(400).json({ success: false, message: messages[0], errors: messages });
  }

  req[target] = value;
  next();
};

module.exports = { validate };
