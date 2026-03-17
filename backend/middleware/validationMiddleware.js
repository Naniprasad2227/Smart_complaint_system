const allowedCategories = ['Road', 'Water', 'Electricity', 'Sanitation', 'General'];
const allowedPriorities = ['Low', 'Medium', 'High'];
const allowedStatuses = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

const clean = (value) => String(value || '').trim();

const sendValidationError = (res, errors) => {
  return res.status(400).json({
    message: 'Validation failed',
    errors,
  });
};

const validateLocationPayload = (location = {}) => {
  const required = ['country', 'state', 'district', 'mandal', 'village'];
  const errors = [];

  required.forEach((field) => {
    if (!clean(location[field])) {
      errors.push(`location.${field} is required`);
    }
  });

  return errors;
};

const validateSubmitComplaint = (req, res, next) => {
  const errors = [];
  const title = clean(req.body?.complaintTitle);
  const description = clean(req.body?.complaintDescription);
  const category = clean(req.body?.category);
  const priority = clean(req.body?.priority);

  if (!title || title.length < 5 || title.length > 160) {
    errors.push('complaintTitle must be between 5 and 160 characters');
  }

  if (!description || description.length < 10 || description.length > 5000) {
    errors.push('complaintDescription must be between 10 and 5000 characters');
  }

  if (category && !allowedCategories.includes(category)) {
    errors.push(`category must be one of: ${allowedCategories.join(', ')}`);
  }

  if (priority && !allowedPriorities.includes(priority)) {
    errors.push(`priority must be one of: ${allowedPriorities.join(', ')}`);
  }

  errors.push(...validateLocationPayload(req.body?.location));

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  return next();
};

const validateUpdateStatus = (req, res, next) => {
  const status = clean(req.body?.status);
  if (!allowedStatuses.includes(status)) {
    return sendValidationError(res, [`status must be one of: ${allowedStatuses.join(', ')}`]);
  }
  return next();
};

const validateAssignWorker = (req, res, next) => {
  const workerId = clean(req.body?.workerId);
  if (!workerId) {
    return sendValidationError(res, ['workerId is required']);
  }
  return next();
};

module.exports = {
  validateSubmitComplaint,
  validateUpdateStatus,
  validateAssignWorker,
};
