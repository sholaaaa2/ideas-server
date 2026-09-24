import { AppError } from "../helpers/index.js";

const extractMongooseValidationErrors = (err) => {
	try {
		return Object.values(err.errors || {})
			.map((e) => e?.message)
			.filter(Boolean);
	} catch {
		return ["Validation failed"];
	}
};

const extractMongoDuplicateErrors = (err) => {
	const dupFields = err?.keyValue ? Object.keys(err.keyValue) : [];
	if (dupFields.length > 0) {
		return dupFields.map(
			(k) => `Duplicate value for '${k}': '${err.keyValue[k]}' already exists`
		);
	}
	return ["Duplicate key error"];
};

const buildErrorPayload = ({ message, errors }) => {
	const normalizedErrors = Array.isArray(errors)
		? errors
		: errors
			? [String(errors)]
			: [];

	return {
		success: false,
		message,
		errors: normalizedErrors,
	};
};

const errorHandler = (err, req, res, next) => {
	let statusCode = 500;
	let message = "Internal Server Error";
	let details = [];

	if (err instanceof AppError) {
		statusCode = err.statusCode ?? 500;
		message = err.message || message;
		details = err.errors || [];
	} else if (err?.name === "ValidationError") {
		statusCode = 400;
		message = "Validation Error";
		details = extractMongooseValidationErrors(err);
	} else if (err?.name === "MongoServerError" || err?.name === "MongoError") {
		if (err?.code === 11000) {
			statusCode = 409;
			message = "Duplicate Key Error";
			details = extractMongoDuplicateErrors(err);
		} else {
			statusCode = 500;
			message = "Database Error";
			details = [err?.message || "Mongo error"];
		}
	} else if (err?.name === "JsonWebTokenError") {
		statusCode = 401;
		message = "Invalid Token";
		details = ["The provided token is invalid"];
	} else if (err?.name === "TokenExpiredError") {
		statusCode = 401;
		message = "Token Expired";
		details = ["The provided token has expired"];
	} else {
		statusCode = err?.statusCode || 500;
		message = err?.message || message;
		details = err?.errors || (err?.message ? [err.message] : []);
	}
	// console.error(`${req.method} ${req.path} - ${statusCode} - ${message}`, err);

	const payload = buildErrorPayload({ message, errors: details });
	res.status(statusCode).json(payload);
};

const notFoundHandler = (req, res) => {
	const payload = buildErrorPayload({
		message: "Not Found",
		errors: [`Route ${req.method} ${req.path} not found`],
	});
	res.status(404).json(payload);
};

export { errorHandler, notFoundHandler };
